/**
 *    watchtower.js 1.5
 */
(function (W) {
  var INFO = {};
  INFO.URL = '';
  INFO.THRESHOLD = 4;
  INFO.ERRORTHRESHOLD = 1;
  INFO.BROWSER = '';
  INFO.DEVICE = '';
  INFO.STREAMPATH = '/stats/stream';
  INFO.ERRORPATH = '/stats/error';
  INFO.throttlePercentage = 10;
  var M = {
    buildNumber: '',
    browser: '',
    device: '',
    zipcode: '',
    currentPage: '0',
    logStack: {},
    timeArray: [],
    errorArray: [],
    ajaxGet: function (url) {
      //Here we need to use SuperAgent/iso-http / still looking into this.
      var xhttp = new XMLHttpRequest();
      xhttp.open('GET', url, true);
      xhttp.send();
    },

    //No need to change in this function.
    sendLog: function (dataArray, path) {
      var logPath = path || INFO.STREAMPATH;
      var dimension = 'b=' + M.getBrowser()
        + '&' + 'd=' + M.getDeviceType()
        + '&' + 'z=' + M.zipcode
        + '&' + 'n=' + M.buildNumber;
      var url = INFO.URL + logPath + '?' + dimension + '&' + dataArray.join('&');

      // send log only if url exists and pages allowed;
      M.isThrottled && M.ajaxGet(url);
    },

    //Here we need to change (navigator will not work in server side)(We can extract this info from http header)
    getBrowser: function () {
      var sBrowser;
      var sUsrAg = (navigator && navigator.userAgent) || '';
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
      } else {
        sBrowser = 'Other';
      }
      return sBrowser;
    },
    isMobile: function (sUsrAg) {
      return sUsrAg.match(/webOS|BlackBerry|Android|iPhone|iPod|Opera Mini|IEMobile|NokiaBrowser|Silk/i);
    },
    getDeviceType: function () {
      var sDeviceType = 'tablet';
      var sUsrAg = (navigator && navigator.userAgent) || '';
      if (sUsrAg.match(/ipad/i)) {
        sDeviceType = 'ipad';
      } else if (sUsrAg.match(/mobile/i)) {
        sDeviceType = 'mobile';
      } else if (sUsrAg.match(/Android|tablet/i)) {// since its not mobile and contains andriod its tablet
        sDeviceType = 'tablet';
      } else if (M.isMobile(sUsrAg)) {
        sDeviceType = 'mobile';
      } else {
        sDeviceType = 'desktop';
      }
      return sDeviceType;
    },
    checkThreshold: function () {
      if (M.timeArray.length >= INFO.THRESHOLD) {
        M.sendLog(M.timeArray);
        M.timeArray = [];
      }
      if (M.errorArray.length >= INFO.ERRORTHRESHOLD) {
        M.sendLog(M.errorArray, INFO.ERRORPATH);
        M.errorArray = [];
      }
    },
    checkPageChange: function () {
      if (M.timeArray.length) {
        M.sendLog(M.timeArray);
      }
      if (M.errorArray.length) {
        M.sendLog(M.errorArray, INFO.ERRORPATH);
      }
      M.logStack = {};
      M.timeArray = [];
      M.errorArray = [];
    },
    Start: function (data, time) {
      M.logStack[data.tag] = {};
      M.logStack[data.tag].startT = time;
    },
    Stop: function (data, time) {
      var logObj = M.logStack[data.tag];
      if (logObj) {
        M.timeArray.push(M.currentPage + '.' + data.tag + '' + '=' + (time - logObj.startT));
        delete M.logStack[data.tag];
        if (data.tag == '0') {
          M.sendLog(M.timeArray);
          M.timeArray = [];
        } else {
          M.checkThreshold();
        }
      }
    },
    Error: function (data, time) {
      M.errorArray.push(M.currentPage + '.' + data.tag + '=' + encodeURIComponent(data.desc));
      M.checkThreshold();
    },
    pageStart: function (data, time) {
      M.checkPageChange();
      M.currentPage = data.tag;
      M.Start(data, time);
    },
    pageEnd: function (data, time) {
      M.Stop(data, time);
      M.sendLog(M.timeArray);
      M.timeArray = [];
    },
    Init: function (odata, time) {
      INFO.URL = odata.url;
      M.isThrottled =  !( Math.random() *100 >= INFO.throttlePercentage );
      M.zipcode = odata.zipcode || '52404';
      M.buildNumber = odata.buildNumber || '';
      if (odata.buffer && odata.buffer.length) {
        var len = odata.buffer.length;
        for (var i = 0; i < len; i++) {
          data = odata.buffer[i];
          if (M[data.cmd]) {
            // call command which is function over M object
            M[data.cmd].call(M, data, data.eventTime);
          }
        }
      }
    },
    /**
     *  main message handler for the worker
     * @param e
     */
    messageHandler: function (e) {
      var data = e.data;
      var eventTime = Date.now();
      if (M[data.cmd]) {
        // call command which is function over M object
        M[data.cmd].call(M, e.data, eventTime);
      }
    },
    /**
     *  main error handler for the worker
     * @param e
     */
    errorHandler: function (e) {
    }
  };
  /* Bindings to web worker */
  W.addEventListener('message', M.messageHandler, false);
  W.addEventListener('error', M.errorHandler, false);
  W.postMessage('Init');
}(self));
