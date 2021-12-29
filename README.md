observe-nodejs
==============

This is a simple library to send structure observations straight out of nodejs
applications (servers and electron apps) into Observe, without having to
round-trip through some logging package. Use of this library is entirely
optional -- there's nothing wrong in going through fluent-bit or OpenTelemetry
or whatever -- but it's convenient as an option for certain use cases.

  * Configure the URL as 'https://collect.observeinc.com/v1/http[/some/path]'

  * Configure the Auth as '(customerid) (datastream-token)'

  * Create an Observer with these parameters

  * Call send({key:value,key2:value2}) to send structured data

Example code
------------

    import { Observer } from 'observe-nodejs';
    
    const params = {
        url: "https://collect.observeinc.com/v1/http/observe-nodejs/main",
        auth: "123456789 secret-token:goes-here-when-allocated"
    };
    
    const error = await O.send({
        "message": "Hello, world!"
    });
    if (error) {    //  some error
        console.warn(`Error sending first observation: ${error}`);
    } else {
        console.log('First observation sent');
    }

You don't actually need to do anything with the return value from send() --
fire-and-forget is a totally legitimate data collection strategy for certain
use cases. You also don't need to synchronously await the send result, because
doing so will obviously block your application waiting for a round trip. You
can chain it as a promise, or use a Node-style asynchronous callback, if you
prefer.

    // Promise style
    O.send({ "message": "Hello, World!" }).then((error) => { error && console.error(error); });

    // Old-school Node Callback style
    O.send({ "message": "Hello, World!" }, (err) => { error && console.error(error); });

This code is free to use in your own programs, under the terms of the Apache
2.0 license.

FAQs
----

  Q1. Is there a CommonJS version of this module?
  A1. No (not yet, at least.)
