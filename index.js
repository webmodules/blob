/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder
  || global.WebKitBlobBuilder
  || global.MSBlobBuilder
  || global.MozBlobBuilder;

/**
 * Check if Blob constructor is supported
 */

var blobSupported = (function() {
  try {
    var a = new Blob(['hi']);
    return a.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if Blob constructor supports ArrayBufferViews
 * Fails in Safari 6, so we need to map to ArrayBuffers there.
 */

var blobSupportsArrayBufferView = blobSupported && (function() {
  try {
    var b = new Blob([new Uint8Array([1,2])]);
    return b.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if BlobBuilder is supported
 */

var blobBuilderSupported = BlobBuilder
  && BlobBuilder.prototype.append
  && BlobBuilder.prototype.getBlob;

/**
 * Helper function that maps ArrayBufferViews to ArrayBuffers
 * Used by BlobBuilder constructor and old browsers that didn't
 * support it in the Blob constructor.
 */

function mapArrayBufferViews(ary) {
  return ary.map(function(chunk) {
    if (chunk.buffer instanceof ArrayBuffer) {
      var buf = chunk.buffer;

      // if this is a subarray, make a copy so we only
      // include the subarray region from the underlying buffer
      if (chunk.byteLength !== buf.byteLength) {
        var copy = new Uint8Array(chunk.byteLength);
        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
        buf = copy.buffer;
      }

      return buf;
    }

    return chunk;
  });
}

function BlobBuilderConstructor(ary, options) {
  options = options || {};

  var bb = new BlobBuilder();
  mapArrayBufferViews(ary).forEach(function(part) {
    bb.append(part);
  });

  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
};

function BlobConstructor(ary, options) {
  return new Blob(mapArrayBufferViews(ary), options || {});
};

if (global.Blob) {
  var stream;

  function promisify(obj) {
    return new Promise(function(resolve, reject) {
      obj.onload =
      obj.onerror = function(evt) {
        obj.onload =
        obj.onerror = null;

        evt.type === 'load'
          ? resolve(obj.result || obj)
          : reject(new Error('Failed to read the blob/file'));
      }
    })
  }


  try {
    new ReadableStream({ type: 'bytes' });
    stream = function strea() {
      var position = 0;
      var blob = this;

      return new ReadableStream({
        type: 'bytes',
        autoAllocateChunkSize: 524288,

        pull: function (controller) {
          var v = controller.byobRequest.view;
          var chunk = blob.slice(position, position + v.byteLength);
          return chunk.arrayBuffer()
          .then(function (buffer) {
            var uint8array = new Uint8Array(buffer);
            var bytesRead = uint8array.byteLength;

            position += bytesRead;
            v.set(uint8array);
            controller.byobRequest.respond(bytesRead);

            if (position >= blob.size) {
              controller.close();
            }
          });
        }
      });
    }
  } catch (e) {
    try {
      new ReadableStream({});
      stream = function stream (blob){
        var position = 0;
        var blob = this;

        return new ReadableStream({
          pull: function (controller) {
            var chunk = blob.slice(position, position + 524288);

            return chunk.arrayBuffer().then(function (buffer) {
              position += buffer.byteLength;
              var uint8array = new Uint8Array(buffer);
              controller.enqueue(uint8array);

              if (position == blob.size) {
                controller.close();
              }
            });
          }
        });
      }
    } catch (e) {
      try {
        new Response('').body.getReader().read();
        stream = function stream() {
          return new Response(this).body;
        }
      } catch (e) {
        stream = function stream() {
          throw new Error('Include https://github.com/MattiasBuelens/web-streams-polyfill');
        }
      }
    }
  }


  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      var fr = new FileReader();
      fr.readAsArrayBuffer(this);
      return promisify(fr);
    }
  }

  if (!Blob.prototype.text) {
    Blob.prototype.text = function text() {
      var fr = new FileReader();
      fr.readAsText(this);
      return promisify(fr);
    }
  }

  if (!Blob.prototype.stream) {
    Blob.prototype.stream = stream;
  }

  BlobBuilderConstructor.prototype = Blob.prototype;
  BlobConstructor.prototype = Blob.prototype;
}

module.exports = (function() {
  if (blobSupported) {
    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
  } else if (blobBuilderSupported) {
    return BlobBuilderConstructor;
  } else {
    return undefined;
  }
})();
