import { request } from 'https';

function maybe(obj, key, def) {
    if (obj.hasOwnProperty(key)) {
        return obj[key];
    }
    return def;
}

function must(obj, key) {
    if (!obj.hasOwnProperty(key)) {
        throw new Error(`The parameter ${key} must be provided.`);
    }
    return obj[key];
}

class Observer {
    //  Parameters:
    //  url -- the URL for the Observe collector service (required)
    //  auth -- the contents of the Bearer authorization header (required)
    //  batchTime -- how frequently to flush queued observations once in queuing mode (in milliseconds) (default 5000.)
    //  batchSize -- how many observations to collect before flushing even if timeout hasn't arrived in queuing mode (default 200.)
    //  sizeLimit -- how many bytes are queued before flushing (default 2000000)
    constructor(params) {
        this.#batchTime = maybe(params, 'batchTime', 5000);
        this.#batchSize = maybe(params, 'batchSize', 200);
        this.#sizeLimit = maybe(params, 'sizeLimit', 2000000);
        this.#url = new URL(must(params, 'url'));
        this.#auth = must(params, 'auth');
    }

    //  Enqueue some datum for sending, and return a promise that resolves when
    //  sending succeeded (or failed.) If nothing is pending, this will by
    //  default immediately send (to reduce latency,) but if some other send
    //  request is already outstanding, it will buffer and send at some time
    //  later (to go into "high throughput" mode of batching under load.) The
    //  datum being sent must be an object. It will be given a `timestamp`
    //  field, unless such as field is already there.
    //
    //  Because this returns a promise, it can be used to await. If you pass in
    //  an cbOpt callback, it will be called in addition to the promise being
    //  resolved.
    send(datum, cbOpt) {
        const prom = this.#enqueue(datum, cbOpt);
        if (!this.#sending) {
            //  in low-latency mode?
            this.#sendQueue();
        } else if (this.#queue.length >= this.#batchSize) {
            //  batch size reached?
            this.#sendQueue();
        } else if (this.#queuesize > this.#sizeLimit) {
            //  hit a payload size limit?
            this.#sendQueue();
        } else {
            //  batch up some stuff
            setTimeout(() => {
                //  If there's something to do, then do it!
                //  But all datum may already have been flushed by the size limit, so
                //  there might be nothing to do.
                if (this.#queue.length > 0) {
                    this.#sendQueue();
                }
            }, this.#batchTime);
        }
        return prom;
    }

    //  sendNow() will immediately attempt to send the observation (and
    //  anything appended before it)
    sendNow(datum, cbOpt) {
        const prom = this.#enqueue(datum, cbOpt);
        this.#sendQueue();
        return prom;
    }

    #queue = [];
    #queuesize = 0;
    #sending = false;
    #batchTime = 5000;
    #batchSize = 200;
    #sizeLimit = 2000000;
    #auth;
    #url;

    #enqueue(datum, cbOpt) {
        //  The implementation is a little messy because we want to support
        //  all three APIs: async/await, Promise, and node-callback.
        if (typeof(datum) !== 'object') {
            console.error('usage error of Observer.send(): datum must be an object');
            return new Promise((resolve, reject) => {
                resolve('The datum must be an object');
            });
        }
        if (!datum.timestamp) {
            datum.timestamp = Date.now();
        }
        let encdatum = null;
        let saveResolve = null;
        const prom = new Promise((resolve, reject) => {
            //  Note that I don't reject; I resolve with an error when things go wrong.
            encdatum = JSON.stringify(datum) + "\n";
            saveResolve = resolve;
        });
        //  Observe can deal with larger observations than 1000k, but it's in
        //  general not a good idea to use observations that big; there's no
        //  real way to reasonably make sense of them.
        if (encdatum.length > 1000001) {
            console.error('usage error of Observer.send(): maximum individual datum size is 1,000,000 bytes');
            return new Promise((resolve, reject) => {
                resolve('The maximum datum size is 1,000,000 bytes');
            });
        }
        this.#queuesize = this.#queuesize + encdatum.length;
        this.#queue.push({
            datum: encdatum,
            cbOpt: cbOpt,
            promise: prom,
            resolve: saveResolve
        });
        return prom;
    }

    #sendQueue() {
        this.#sending = true;
        const queue = this.#queue;
        this.#queue = [];
        const queuesize = this.#queuesize;
        this.#queuesize = 0;

        const whenDone = ((err) => {
            //  When done, if there's nothing queued, then we're back in
            //  low-latency mode.
            if (this.#queue.length == 0) {
                this.#sending = false;
            }
            if (!err) {
                //  API says: the "null" value, not just a falsy value
                err = null;
            }
            //  Resolve each pending item.
            queue.forEach((qi) => {
                //  A node callback can throw, which we should be robust against.
                if (qi.cbOpt) {
                    try {
                        qi.cbOpt(err);
                    } catch (x) {
                        console.error(`exception in send callback: ${x}`);
                        //  nom nom nom
                    }
                }
                //  Promise resolvers do NOT throw (those get promoted to rejects.)
                qi.resolve(err);
            });
        }).bind(this);

        //  enqueue outgoing request
        //
        const options = {
            host: this.#url.host,
            path: `${this.#url.pathname}${this.#url.search}`,
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.#auth}`,
                'Content-Length': `${queuesize}`,
                'Content-Type': 'application/x-ndjson'
            }
        };
        const out = request(options, (res) => {
            let data = '';
            res.on('data', (d) => {
                data = data + d;
            });
            res.on('close', () => {
                if (res.statusCode > 299) {
                    console.log('Observe result', data);
                    whenDone(`Observe Bad HTTP result: ${res.statusCode} ${res.statusMessage}`);
                } else {
                    whenDone(null);
                }
            });
        });
        //  Because I limit payload size to 2 MB, I don't need to try to
        //  asynchronize writing a little bit at a time. Let buffering deal
        //  with it!
        queue.forEach((it) => {
            out.write(it.datum);
        });
        out.end();
    }
}


export { Observer };

