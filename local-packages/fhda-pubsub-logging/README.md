## FHDA Pubsub Logging

`fhda-pubsub-logging` is a logging framework for Node.js applications. Yes, there are 10,000s of logging packages in the NPM universe, but I've found all of them in one way or another are missing features that detract from the developer experience. So, I've rolled my own with the goal of providing developer-first logging in non-production environments (i.e.  for debugging), but retaining ultra high-speed event delivery in production environments.

### Features

* Externalized config management using `config`
* Named loggers
* Built-in formatters
  * **Pretty:** Beautiful colored objects and formatted stack traces for live debugging
  * **Pretty (no colors):** Same as above, but drops the coloring for logging outputs that cannot benefit from it
* Built-in transports
  * **Console:** Writes to `process.stdout`. Uses the `pretty` formatter by default to beautify the output
  * **Raw Console:** Mostly for debugging the logging behavior. Also used for informal benchmark tests against Winston
  * **Rotating File:** Write log events to a rotating file stream. Uses the `pretty-nocolors` formatter by default to beautify the output
  * **Splunk:** Delivers events to a Splunk HTTP collector for indexing
* Built on top of `eventemitter3` so that events are not only dispatched to "traditional" logging transports, but the developer can selectively dispatch events to other parts of the application (for example, rich WebSocket dashboards and more)
* Easy to customize - formatters and transports are fully modular
* Stupid fast. Using `matcha` benchmarks, comparing our raw console transport to the Winston console transport, typical speed improvements of 2x - 7.5x observed against Winston.

### Installation

`npm install --save git+http://stash.ad.fhda.edu/scm/npmp/fhda-pubsub-logging.git#latest`

**Note:** Do not use the Yarn package manager for the short-term. A bug needs to be resolved regarding their handling of the Git URLs with tags instead of hashes.

### Getting Started

#### Configuration

**Existing `config` Users, App Kit Applications:** Use the configuration example below to get started quickly.

**New Users:** you are new to config, then first create a `config` directory in your project, and then create a JavaScript file named `local.js`. Copy and paste the sample configuration below:

```javascript
module.exports = {
  logging: {
    level: 'debug',
    source: 'my-application',
    environment: 'test',
    transports: {
      console: {}
    }
  }
}
```

#### Application Usage

The example below creates an unnamed logger, and then demonstrates several of the function calls you can use to dispatch log events based on severity.

```javascript
'use strict'
let Logger = require('fhda-pubsub-logging')();

// Log an error
Logger.error(`Ruh-roh! An error occurred`, {
  error: error
});

// Log a warning
Logger.warn(`This is about to become a problem`);

// Log some information
Logger.info(`User successfully authenticated`, {
  campusId: ...,
  name: ...
});

// Log verbose event (typically for debugging/non-production)
Logger.verbose(`Here is an event happening deeper in the backend of my application`);

// Log a debug event (the lowest default severity, use this for logging very low-level or wire traffic in your application)
Logger.debug(`Processing request to http://localhost:8080/my/web/service`, {
  status: 200,
  campusId: ...,
  moreData: { ... }
});
```

Or created a named logger, and your log events will have an additional label property added (very useful for transports that do indexing and search like Splunk):

```javascript
'use strict'
let Logger = require('fhda-pubsub-logging')('app-component-here');

// Log some information
Logger.info(`User successfully authenticated`, {
  campusId: ...,
  name: ...
});
```

### Configuration Scenarios

#### Setting Up Splunk

Add an additional transport to your config as shown below:

```javascript
module.exports = {
  logging: {
    level: 'debug',
    source: 'my-application',
    environment: 'test',
    transports: {
      console: {},
      splunk: {
        uri: 'URI_GOES_HERE',
        collectorAuthKey: 'AUTH_KEY_GOES_HERE'
      }
    }
  }
}
```

Provides values for the URI to the HTTP Event Collector endpoint, and the authorization key from Splunk that will permit events to be accepted for indexing.

