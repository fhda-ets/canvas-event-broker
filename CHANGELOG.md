# Changelog

## 2.2.1 - May 2017

- **Fixed:** Resolved several low level bugs and improved error handling around student sync
- Refactored `College.syncStudent` with async/await syntax

## 2.2.0 - April 2017

- New enrollment reconciliation
- New support for scheduled jobs, configurable per college
- Very initial starting ingredients to support De Anza online orientation project
- Support for building Docker images derived from our internal base image
- Miscellaneous fix

## 2.1.0 - April 2017

- Migrating to Node v7+ for async/await syntax
	- Refactored Banner event handling for async/await
	- Major refactor of the create course websocket action
	- Added JSDoc plugin for async/await syntax
- New template-based generation of Canvas course names and codes when creating sites
	- Specifications can be shared across all colleges, or defined _per college_
- Updated documentation

## 2.0.0 - Fall 2016

- Initial release of Canvas Event Broker as a separate application, independent of the Canvas Site Manager UI. Provided to De Anza College for beta testing during the Winter 2017 and Spring 2017 academic periods.