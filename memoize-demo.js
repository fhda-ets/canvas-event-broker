let MemoizePromise = require('promise-memoize');

let context = {
    hello: 'world'
};

let memoized = MemoizePromise(function(publisherId) {
    console.log(this);
    console.log(publisherId);
    return Promise.resolve(true);
}).bind(context);

memoized(125);