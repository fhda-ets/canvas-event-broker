/**
 * Copyright (c) 2016, Foothill-De Anza Community College District
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation and/or
 * other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';
let Colleges = require('../CollegeManager.js');
let DatasetBuilder = require('./DatasetBuilder.js');
let Logger = require('fhda-pubsub-logging')('test-suite');
let LoggerWebsocket = require('fhda-pubsub-logging')('mock-websocket');
let RandomItem = require('random-item');
let Should = require('should');

// Load WS handler modules
let WsCreateCanvAttribute = require('../websocket-handlers/banner/CreateCanvAttribute.js');
let WsCreateCourse = require('../websocket-handlers/canvas/CreateCourse.js');
let WsDeleteSections = require('../websocket-handlers/canvas/DeleteSections.js');
let WsDeleteCourse = require('../websocket-handlers/canvas/DeleteCourse.js');
let WsGetCourses = require('../websocket-handlers/canvas/GetCourses.js');
let WsGetEnrollmentTerms = require('../websocket-handlers/canvas/GetEnrollmentTerms.js');
let WsSyncStudent = require('../websocket-handlers/canvas/SyncStudent.js');

for(let collegeId in Colleges) {
    // Skip bound functions
    if(typeof Colleges[collegeId] === 'function') {
        continue;
    }

    // Lookup college configuration by property key
    let college = Colleges[collegeId];

    describe(`College implementation - "${college.name}"`,  function() {

        // Configure Mocha
        this.timeout(20000);

        describe('Canvas API client', function() {

            it('Get enrollment terms', function() {
                return college.canvasApi
                    .getEnrollmentTerms()
                    .then(terms => {
                        terms.should.matchEach(term => {
                            return term.should.have.properties(['id']);
                        });
                    });
            });

            it('Get courses for user by academic term', function() {
                return college.canvasApi
                    .getCoursesForUser(null, '10716429');
            });

            it('Get all courses by enrollment term', function() {
                return college.canvasApi
                    .getCoursesForEnrollmentTerm(5);
            });
        });

        describe.only('High-level college features', function() {
            // Configure Mocha to be patient (this is a potentially long process)
            this.timeout(60000 * 5);

            it.only('Reconcile enrollment for the current term', function() {
                return college.reconcileEnrollment();
            });
        });

        describe('Websocket API handlers', function() {

            // Create a mock request for creating new Canvas courses
            let mockCreateRequest = {
                college: college.name,
                parentTerm: undefined,
                parentCrn: undefined,
                sections: []
            };

            // Create a mock websocket object to bind into event handler
            let mockWebsocket = {
                decoded_token: {},
                emit: function(eventType, data={}) {
                    LoggerWebsocket.verbose(`Handled mock websocket event`, [{eventType: eventType}, data]);
                }
            };

            let courseContext = undefined;

            it('Can create CANV faculty attributes for one or more IDs', function() {
                // Configure test
                this.timeout(180000);

                // Create mock websocket request
                let mockRequest = {
                    campusIds: ['10716429']
                };

                // Handle mock request
                return WsCreateCanvAttribute.bind(mockWebsocket)(mockRequest, result => {
                    Logger.info('Updated CANV attributes for persons', result);
                });
            });

            it('Lookup test courses', function() {
                // Configure test
                this.timeout(10000);

                return DatasetBuilder
                    .getTestCourses(college.name)
                    .tap(courses => {
                        // Mock parent section
                        mockCreateRequest.parentTerm = courses[0].term;
                        mockCreateRequest.parentCrn = courses[0].crn;

                        // Verify parent course
                        Should.equal(mockCreateRequest.parentTerm, courses[0].term);
                        Should.equal(mockCreateRequest.parentCrn, courses[0].crn);

                        // Add sections to request
                        for(let idx = 0; idx < courses.length; idx++) {
                            mockCreateRequest.sections.push({
                                term: courses[idx].term,
                                crn: courses[idx].crn
                            });

                            // Verify child assignment
                            Should.equal(mockCreateRequest.sections[idx].term, courses[idx].term);
                            Should.equal(mockCreateRequest.sections[idx].crn, courses[idx].crn);
                        }
                    });
            });

            it('Can get enrollment terms from Canvas', function() {
                // Configure test
                this.timeout(180000);

                // Create mock websocket request
                let mockRequest = {
                    college: college.name,
                };

                // Handle mock request
                return WsGetEnrollmentTerms.bind(mockWebsocket)(mockRequest, result => {
                    Logger.info('Got enrollment terms from Canvas', result);
                });
            });

            it('Can create new course site', function() {
                // Configure test
                this.timeout(180000);

                // Handle mock request
                // eslint-disable-next-line
                return WsCreateCourse.bind(mockWebsocket)(mockCreateRequest, result => {
                    Should.equal(result.status, 'done');
                })
                .then(context => {
                    courseContext = context;
                });
            });

            it('Can get Canvas courses by user', function() {
                // Configure test
                this.timeout(30000);

                // Update mock websocket with a user identity
                mockWebsocket.decoded_token['aud'] = courseContext.instructors[0].campusId;

                // Create mock websocket request
                let mockRequest = {
                    college: college.name,
                    term: courseContext.parentTerm
                };

                // Handle mock request
                return WsGetCourses.bind(mockWebsocket)(mockRequest, result => {
                    (result.length).should.be.aboveOrEqual(1);
                });
            });

            it('Can resync enrollment for a student', function() {
                // Configure test
                this.timeout(30000);

                // Get a random CRN and enrollment
                let randomCrn = RandomItem(Object.keys(courseContext.enrollment));
                let randomEnrollment = RandomItem(courseContext.enrollment[randomCrn]);

                // Create mock websocket request
                let mockRequest = {
                    college: college.name,
                    term: courseContext.parentTerm,
                    identity: {
                        pidm: randomEnrollment[0].pidm
                    }
                };

                // Handle mock request
                // eslint-disable-next-line
                return WsSyncStudent.bind(mockWebsocket)(mockRequest, result => {
                });
            });

            it('Can delete sections from a course site', function() {
                // Configure test
                this.timeout(180000);

                // Create mock delete sections request
                let mockRequest = {
                    college: college.name,
                    sections: courseContext.sections
                };

                // Handle mock request
                // eslint-disable-next-line
                return WsDeleteSections.bind(mockWebsocket)(mockRequest, result => {
                });
            });

            it('Can delete an existing course site', function() {
                // Configure test
                this.timeout(30000);

                // Create mock delete course request
                let mockRequest = {
                    college: college.name,
                    canvasCourseId: courseContext.canvasCourse.id
                };

                // Handle mock request
                // eslint-disable-next-line
                return WsDeleteCourse.bind(mockWebsocket)(mockRequest, result => {
                });
            });

        });
    });
}
