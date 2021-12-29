'use strict';
/* this main program demonstrates sending an observation */

import { Observer } from './observer.js';

//  The URL is likely to be fine the way it is.
//  The auth information (customer ID and token) is allocated in the Workspace
//  settings for the particular Datastream that you want to send into.
//  More parameters are documented in the constructor for the Observer object.
const params = {
    url: "https://collect.observeinc.com/v1/http/observe-nodejs/main",
    auth: "123456789 secret-token:goes-here-when-allocated"
};

//  For purposes of this test program, it's convenient to pick up values from
//  the environment. Implement the convention that OBSERVE_someName ends up setting
//  the parameter 'someName' (lowercased.)
Object.entries(process.env).forEach(([name, value]) => {
    //  identifier-style environment variables are parameters in this test
    const match = /^OBSERVE_([A-Za-z][A-Za-z_]+)$/.exec(name);
    if (match) {
        const paramname = match[1];
        params[paramname] = value;
    }
});

//  The Observer is a class for an object that sends observations. It can do
//  aggregation and buffering of various kinds, which you can configure in the
//  parameters. The defaults should be sufficient for most use cases.
const O = new Observer(params);

//  Send semi-structured data, which will show up as fields in the observation.
//  If auth or configuration is wrong, this will resolve with an error, else it
//  will resolve with the null value.
const error = await O.send({
    "message": "Hello, world!"
});
if (error) {    //  some error
    console.warn(`Error sending first observation: ${error}`);
} else {
    console.log('First observation sent');
}

//  Note that you can also treat async functions as promises:
const prom = O.send({
    "message": "Second hello"
});
prom.then((error) => {
    if (error) {    //  some error
        console.warn(`Error sending second observation: ${error}`);
    } else {
        console.log('Second observation sent');
    }

    //  Finally, if you are O.G. Node, you can pass in a callback function as the
    //  second argument.
    O.send({
        "message": "Third hello"
    }, (error) => {
        if (error) {    //  some error
            console.warn(`Error sending third observation: ${error}`);
        } else {
            console.log('Third observation sent');
        }
        //  The Observer will not by itself keep the process alive if there is nothing else to do.
    });
}).catch(() => {
    //  Note that errors are returned as values, not as rejections,
    //  to make the usage experience more straightforward even if
    //  connectivity is spotty.
    console.err('This will never happen');
});


