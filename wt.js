(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
    require('whatwg-fetch');
    module.exports = self.fetch.bind(self);

},{"whatwg-fetch":2}],2:[function(require,module,exports){
    (function(self) {
        'use strict';

        if (self.fetch) {
            return
        }

        var support = {
            searchParams: 'URLSearchParams' in self,
            iterable: 'Symbol' in self && 'iterator' in Symbol,
            blob: 'FileReader' in self && 'Blob' in self && (function() {
                try {
                    new Blob()
                    return true
                } catch(e) {
                    return false
                }
            })(),
            formData: 'FormData' in self,
            arrayBuffer: 'ArrayBuffer' in self
        }

        if (support.arrayBuffer) {
            var viewClasses = [
                '[object Int8Array]',
                '[object Uint8Array]',
                '[object Uint8ClampedArray]',
                '[object Int16Array]',
                '[object Uint16Array]',
                '[object Int32Array]',
                '[object Uint32Array]',
                '[object Float32Array]',
                '[object Float64Array]'
            ]

            var isDataView = function(obj) {
                return obj && DataView.prototype.isPrototypeOf(obj)
            }

            var isArrayBufferView = ArrayBuffer.isView || function(obj) {
                    return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
                }
        }

        function normalizeName(name) {
            if (typeof name !== 'string') {
                name = String(name)
            }
            if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
                throw new TypeError('Invalid character in header field name')
            }
            return name.toLowerCase()
        }

        function normalizeValue(value) {
            if (typeof value !== 'string') {
                value = String(value)
            }
            return value
        }

        // Build a destructive iterator for the value list
        function iteratorFor(items) {
            var iterator = {
                next: function() {
                    var value = items.shift()
                    return {done: value === undefined, value: value}
                }
            }

            if (support.iterable) {
                iterator[Symbol.iterator] = function() {
                    return iterator
                }
            }

            return iterator
        }

        function Headers(headers) {
            this.map = {}

            if (headers instanceof Headers) {
                headers.forEach(function(value, name) {
                    this.append(name, value)
                }, this)

            } else if (headers) {
                Object.getOwnPropertyNames(headers).forEach(function(name) {
                    this.append(name, headers[name])
                }, this)
            }
        }

        Headers.prototype.append = function(name, value) {
            name = normalizeName(name)
            value = normalizeValue(value)
            var oldValue = this.map[name]
            this.map[name] = oldValue ? oldValue+','+value : value
        }

        Headers.prototype['delete'] = function(name) {
            delete this.map[normalizeName(name)]
        }

        Headers.prototype.get = function(name) {
            name = normalizeName(name)
            return this.has(name) ? this.map[name] : null
        }

        Headers.prototype.has = function(name) {
            return this.map.hasOwnProperty(normalizeName(name))
        }

        Headers.prototype.set = function(name, value) {
            this.map[normalizeName(name)] = normalizeValue(value)
        }

        Headers.prototype.forEach = function(callback, thisArg) {
            for (var name in this.map) {
                if (this.map.hasOwnProperty(name)) {
                    callback.call(thisArg, this.map[name], name, this)
                }
            }
        }

        Headers.prototype.keys = function() {
            var items = []
            this.forEach(function(value, name) { items.push(name) })
            return iteratorFor(items)
        }

        Headers.prototype.values = function() {
            var items = []
            this.forEach(function(value) { items.push(value) })
            return iteratorFor(items)
        }

        Headers.prototype.entries = function() {
            var items = []
            this.forEach(function(value, name) { items.push([name, value]) })
            return iteratorFor(items)
        }

        if (support.iterable) {
            Headers.prototype[Symbol.iterator] = Headers.prototype.entries
        }

        function consumed(body) {
            if (body.bodyUsed) {
                return Promise.reject(new TypeError('Already read'))
            }
            body.bodyUsed = true
        }

        function fileReaderReady(reader) {
            return new Promise(function(resolve, reject) {
                reader.onload = function() {
                    resolve(reader.result)
                }
                reader.onerror = function() {
                    reject(reader.error)
                }
            })
        }

        function readBlobAsArrayBuffer(blob) {
            var reader = new FileReader()
            var promise = fileReaderReady(reader)
            reader.readAsArrayBuffer(blob)
            return promise
        }

        function readBlobAsText(blob) {
            var reader = new FileReader()
            var promise = fileReaderReady(reader)
            reader.readAsText(blob)
            return promise
        }

        function readArrayBufferAsText(buf) {
            var view = new Uint8Array(buf)
            var chars = new Array(view.length)

            for (var i = 0; i < view.length; i++) {
                chars[i] = String.fromCharCode(view[i])
            }
            return chars.join('')
        }

        function bufferClone(buf) {
            if (buf.slice) {
                return buf.slice(0)
            } else {
                var view = new Uint8Array(buf.byteLength)
                view.set(new Uint8Array(buf))
                return view.buffer
            }
        }

        function Body() {
            this.bodyUsed = false

            this._initBody = function(body) {
                this._bodyInit = body
                if (!body) {
                    this._bodyText = ''
                } else if (typeof body === 'string') {
                    this._bodyText = body
                } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
                    this._bodyBlob = body
                } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
                    this._bodyFormData = body
                } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                    this._bodyText = body.toString()
                } else if (support.arrayBuffer && support.blob && isDataView(body)) {
                    this._bodyArrayBuffer = bufferClone(body.buffer)
                    // IE 10-11 can't handle a DataView body.
                    this._bodyInit = new Blob([this._bodyArrayBuffer])
                } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
                    this._bodyArrayBuffer = bufferClone(body)
                } else {
                    throw new Error('unsupported BodyInit type')
                }

                if (!this.headers.get('content-type')) {
                    if (typeof body === 'string') {
                        this.headers.set('content-type', 'text/plain;charset=UTF-8')
                    } else if (this._bodyBlob && this._bodyBlob.type) {
                        this.headers.set('content-type', this._bodyBlob.type)
                    } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                        this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
                    }
                }
            }

            if (support.blob) {
                this.blob = function() {
                    var rejected = consumed(this)
                    if (rejected) {
                        return rejected
                    }

                    if (this._bodyBlob) {
                        return Promise.resolve(this._bodyBlob)
                    } else if (this._bodyArrayBuffer) {
                        return Promise.resolve(new Blob([this._bodyArrayBuffer]))
                    } else if (this._bodyFormData) {
                        throw new Error('could not read FormData body as blob')
                    } else {
                        return Promise.resolve(new Blob([this._bodyText]))
                    }
                }

                this.arrayBuffer = function() {
                    if (this._bodyArrayBuffer) {
                        return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
                    } else {
                        return this.blob().then(readBlobAsArrayBuffer)
                    }
                }
            }

            this.text = function() {
                var rejected = consumed(this)
                if (rejected) {
                    return rejected
                }

                if (this._bodyBlob) {
                    return readBlobAsText(this._bodyBlob)
                } else if (this._bodyArrayBuffer) {
                    return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
                } else if (this._bodyFormData) {
                    throw new Error('could not read FormData body as text')
                } else {
                    return Promise.resolve(this._bodyText)
                }
            }

            if (support.formData) {
                this.formData = function() {
                    return this.text().then(decode)
                }
            }

            this.json = function() {
                return this.text().then(JSON.parse)
            }

            return this
        }

        // HTTP methods whose capitalization should be normalized
        var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

        function normalizeMethod(method) {
            var upcased = method.toUpperCase()
            return (methods.indexOf(upcased) > -1) ? upcased : method
        }

        function Request(input, options) {
            options = options || {}
            var body = options.body

            if (input instanceof Request) {
                if (input.bodyUsed) {
                    throw new TypeError('Already read')
                }
                this.url = input.url
                this.credentials = input.credentials
                if (!options.headers) {
                    this.headers = new Headers(input.headers)
                }
                this.method = input.method
                this.mode = input.mode
                if (!body && input._bodyInit != null) {
                    body = input._bodyInit
                    input.bodyUsed = true
                }
            } else {
                this.url = String(input)
            }

            this.credentials = options.credentials || this.credentials || 'omit'
            if (options.headers || !this.headers) {
                this.headers = new Headers(options.headers)
            }
            this.method = normalizeMethod(options.method || this.method || 'GET')
            this.mode = options.mode || this.mode || null
            this.referrer = null

            if ((this.method === 'GET' || this.method === 'HEAD') && body) {
                throw new TypeError('Body not allowed for GET or HEAD requests')
            }
            this._initBody(body)
        }

        Request.prototype.clone = function() {
            return new Request(this, { body: this._bodyInit })
        }

        function decode(body) {
            var form = new FormData()
            body.trim().split('&').forEach(function(bytes) {
                if (bytes) {
                    var split = bytes.split('=')
                    var name = split.shift().replace(/\+/g, ' ')
                    var value = split.join('=').replace(/\+/g, ' ')
                    form.append(decodeURIComponent(name), decodeURIComponent(value))
                }
            })
            return form
        }

        function parseHeaders(rawHeaders) {
            var headers = new Headers()
            rawHeaders.split(/\r?\n/).forEach(function(line) {
                var parts = line.split(':')
                var key = parts.shift().trim()
                if (key) {
                    var value = parts.join(':').trim()
                    headers.append(key, value)
                }
            })
            return headers
        }

        Body.call(Request.prototype)

        function Response(bodyInit, options) {
            if (!options) {
                options = {}
            }

            this.type = 'default'
            this.status = 'status' in options ? options.status : 200
            this.ok = this.status >= 200 && this.status < 300
            this.statusText = 'statusText' in options ? options.statusText : 'OK'
            this.headers = new Headers(options.headers)
            this.url = options.url || ''
            this._initBody(bodyInit)
        }

        Body.call(Response.prototype)

        Response.prototype.clone = function() {
            return new Response(this._bodyInit, {
                status: this.status,
                statusText: this.statusText,
                headers: new Headers(this.headers),
                url: this.url
            })
        }

        Response.error = function() {
            var response = new Response(null, {status: 0, statusText: ''})
            response.type = 'error'
            return response
        }

        var redirectStatuses = [301, 302, 303, 307, 308]

        Response.redirect = function(url, status) {
            if (redirectStatuses.indexOf(status) === -1) {
                throw new RangeError('Invalid status code')
            }

            return new Response(null, {status: status, headers: {location: url}})
        }

        self.Headers = Headers
        self.Request = Request
        self.Response = Response

        self.fetch = function(input, init) {
            return new Promise(function(resolve, reject) {
                var request = new Request(input, init)
                var xhr = new XMLHttpRequest()

                xhr.onload = function() {
                    var options = {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: parseHeaders(xhr.getAllResponseHeaders() || '')
                    }
                    options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
                    var body = 'response' in xhr ? xhr.response : xhr.responseText
                    resolve(new Response(body, options))
                }

                xhr.onerror = function() {
                    reject(new TypeError('Network request failed'))
                }

                xhr.ontimeout = function() {
                    reject(new TypeError('Network request failed'))
                }

                xhr.open(request.method, request.url, true)

                if (request.credentials === 'include') {
                    xhr.withCredentials = true
                }

                if ('responseType' in xhr && support.blob) {
                    xhr.responseType = 'blob'
                }

                request.headers.forEach(function(value, name) {
                    xhr.setRequestHeader(name, value)
                })

                xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
            })
        }
        self.fetch.polyfill = true
    })(typeof self !== 'undefined' ? self : this);

},{}],3:[function(require,module,exports){
    /**
     *    watchtower.js 1.5
     */

// Dependencies
    const fetch = require('isomorphic-fetch');
    /**
     * NodeJS Module for Watchtower Analytics. The current implementation invokes the watchtower REST API for "PUSH" only.
     */
    class Watchtower {
        // WatchTower global values

        // TBD externalize to config
        constructor(webworker) {
            // Init Global variable.
            this.wt = {
                buildNumber: '',
                browser: '',
                device: '',
                zipcode: '',
                currentPage: '10',
                logStack: {},
                timeArray: [],
                errorArray: []
            };

            // WATCHOWER GLOBAL CONGIGURATION
            this.INFO = {
                URL: '',
                THRESHOLD: 1,
                ERRORTHRESHOLD: 1,
                THROTTLEPERCENTAGE: 100,
                BROWSER: '',
                DEVICE: '',
                STREAMPATH: '/stats/stream',
                ERRORPATH: '/stats/error'
            };

            this.isThrottled = '';

            if (webworker) {
                webworker.addEventListener('message', this.messageHandler, false);
                webworker.addEventListener('error', this.errorHandler, false);
                webworker.postMessage('init');
            } else {
                // This is work around for server side code.We will extract these parameter from config file.
                const params = {
                    url: 'https://watchtower.edge-csp1-e1-npe.target.com',
                    // url: 'testurl',
                    zipcode: '',
                    buildNumber: 10
                };
                this.init(params);
            }
        }

        /**
         *TODO.Add desc
         */
        init(params, time) {
            this.INFO.URL = params.url;
            this.isThrottled = !(Math.random() * 100 >= this.INFO.throttlePercentage);
            this.wt.zipcode = params.zipcode || '52404';
            this.wt.buildNumber = params.buildNumber || '';
            // Iterate through buffer object
            if (params.buffer && params.buffer.length) {
                const len = params.buffer.length;
                /* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }]*/
                for (let i = 0; i < len; ++i) {
                    params = params.buffer[i];
                    if (this[params.cmd]) {
                        // call command which is function over  object
                        this[params.cmd].call(this, params, params.eventTime);
                    }
                }
            }
        }

        /* TODO[Add desc here]
         * @param dataArray
         * @param path
         * Function type : Private.
         */
        sendLog(dataArray, path) {
            const logPath = path || this.INFO.STREAMPATH;
            const dimension = `b=${Watchtower.getBrowser()}&d=${this.getDeviceType()}&z=${this.wt.zipcode}&n=${this.wt.buildNumber}`;
            const url = `${this.INFO.URL}${logPath}?${dimension}&${dataArray.join('&')}`;

            // TODO : commented isThrottled By Ashutosh revert this change before pushing this
            // this.isThrottled && this.ajaxGet(url);
            // is URL ??
            if (!url) {
                // console.log("Url is missing!!");
                return;
            }

            try {
                // update here follow fetch module.No need to throw error
                fetch(url)
                    .then((response) => {
                    if (response && response.status === 200) {
                    // console.log("success");
                    return;
                }
            });
            } catch (e) {
                // console.log("In catch block" + e);
            }
        }

        /**
         * This function will used to get the browser information from the navigator object,
         * for server calls setting browserType = "Node-Server".
         * @returns type of browser.
         * Function type : Private.
         */
        static getBrowser() {
            // Added this check to run to make this function work in server side also.
            if (typeof (navigator) === 'undefined' && typeof (window) === 'undefined') {
                return 'testnode';
            }

            let sBrowser = 'Other';
            const sUsrAg = (navigator && navigator.userAgent) || '';

            if (sUsrAg.indexOf('Chrome') > -1) {
                sBrowser = 'Chrome';
            } else if (sUsrAg.indexOf('Safari') > -1) {
                sBrowser = 'Safari';
            } else if (sUsrAg.indexOf('Opera') > -1) {
                sBrowser = 'Opera';
            } else if (sUsrAg.indexOf('Firefox') > -1) {
                sBrowser = 'Firefox';
            } else if (sUsrAg.indexOf('MSIE') > -1) {
                sBrowser = 'IE';
            }
            return sBrowser;
        }
        /*
         * Function will used to identify the caller
         * Function type : Private.
         **/
        static isMobile(sUsrAg) {
            return sUsrAg.match(/webOS|BlackBerry|Android|iPhone|iPod|Opera Mini|IEMobile|NokiaBrowser|Silk/i);
        }

        /**
         * This function will used to get DeviceType information from the navigator object,
         * for server calls setting DeviceType = "Node-Server".
         * @returns type of browser.
         * Function type : Private.
         */
        getDeviceType() {
            // Added this check to run to make this function work in server side also.
            if (typeof (navigator) === 'undefined' && typeof (window) === 'undefined') {
                return 'testnode';
            }

            let sDeviceType = 'tablet';
            /* global getDeviceType navigator:true */
            const sUsrAg = (navigator && navigator.userAgent) || '';
            if (sUsrAg.match(/ipad/i)) {
                sDeviceType = 'ipad';
            } else if (sUsrAg.match(/mobile/i)) {
                sDeviceType = 'mobile';
            } else if (sUsrAg.match(/Android|tablet/i)) { // since its not mobile and contains andriod its tablet
                sDeviceType = 'tablet';
            } else if (Watchtower.isMobile(sUsrAg)) {
                sDeviceType = 'mobile';
            } else {
                sDeviceType = 'desktop';
            }
            return sDeviceType;
        }
        // THRESHOLD is deprecated
        checkThreshold() {
            if (this.wt.timeArray.length >= this.INFO.THRESHOLD) {
                this.sendLog(this.wt.timeArray);
                this.wt.timeArray = [];
            }
            if (this.wt.errorArray.length >= this.INFO.ERRORTHRESHOLD) {
                this.sendLog(this.wt.errorArray, this.INFO.ERRORPATH);
                this.wt.errorArray = [];
            }
        }

        checkPageChange() {
            if (this.wt.timeArray.length) {
                this.sendLog(this.wt.timeArray);
            }
            if (this.wt.errorArray.length) {
                this.sendLog(this.wt.errorArray, this.INFO.ERRORPATH);
            }

            this.wt.logStack = {};
            this.wt.timeArray = [];
            this.wt.errorArray = [];
        }
        /**
         * Function type : Public
         */
        start(data, time) {
            this.wt.logStack[data.tag] = {};
            this.wt.logStack[data.tag].startT = time;
        }
        /**
         * TODO [Add desc here].
         * Function type : Public
         */
        stop(data, time) {
            const logObj = this.wt.logStack[data.tag];
            if (logObj) {
                const dimension = `b=${Watchtower.getBrowser()}&d=${this.getDeviceType()}&z=${this.wt.zipcode}&n=${this.wt.buildNumber}`;
                this.wt.timeArray.push(this.wt.currentPage + '.' + data.tag + '' + '=' + (time-logObj.startT));
                delete this.wt.logStack[data.tag];
                if (data.tag === '0') {
                    this.sendLog(this.wt.timeArray);
                    this.wt.timeArray = [];
                } else {
                    this.checkThreshold();
                }
            }
        }

        error(data, time) {
            this.wt.errorArray.push(this.wt.currentPage + '.' + data.tag + '=' + encodeURIComponent(data.desc));
            this.checkThreshold();
        }

        // No need to change here.
        pageStart(data, time) {
            this.checkPageChange();
            this.wt.currentPage = data.tag;
            this.start(data, time);
        }

        pageEnd(data, time) {
            this.stop(data, time);
            this.sendLog(this.wt.timeArray);
            this.wt.timeArray = [];
        }

        /**
         *  main message handler for the worker
         * @param e
         */
        messageHandler(e) {
            const data = e.data;
            const eventTime = Date.now();
            if (this[data.cmd]) {
                // call command which is function over M object
                this[data.cmd].call(this, e.data, eventTime);
            }
        }
        /**
         *  main error handler for the worker
         * @param e
         */
        static errorHandler(e) {

        }

        /**
         *TODO.Add desc here
         */
        s(t) {
            this.start({
                tag: t
            }, Date.now());
        }

        /**
         *TODO.Add desc here
         */
        e(t) {
            this.stop({
                tag: t
            }, Date.now());
        }

        /**
         *TODO.Add desc here
         */
        ps(t) {
            this.pageStart({
                tag: t
            }, Date.now());
        }

        /**
         *TODO.Add desc here
         */
        err(t, descp) {
            this.pageStart({
                tag: t,
                desc: descp
            }, Date.now());
        }
    }// End WatchTower Module()

// Export Module
    module.exports = Watchtower;

},{"isomorphic-fetch":1}]},{},[3]);
