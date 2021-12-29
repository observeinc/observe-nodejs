#!/bin/bash

# Yes, this means anyone on the internet can send some observations to this stream.
# DDoS-ing is a crime, and rate limiting will take care of the rest.
export OBSERVE_auth='101 ds1fa2HjMS904Ry4GbQw:L1EGlI3Ng40P-qxLGKBviDWt_WaoHUQ9'
export OBSERVE_url='https://collect.observe-eng.com/v1/http/testing'
npm test
