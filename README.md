Blob
====

A module that exports a function that uses `window.Blob` when available,
and a `BlobBuilder` with any vendor prefix in other cases.

If neither is available, it exports `undefined`.


Installation
------------

``` bash
$ npm install blob
```


Example
-------

``` js
var blob = require('blob');
var b = blob(['hi', 'constructing', 'a', 'blob']);
```


License
-------

MIT
