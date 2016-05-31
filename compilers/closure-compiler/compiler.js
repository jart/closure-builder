/**
 * @fileoverview Closure Builder - Closure online compiler
 *
 * @license Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author mbordihn@google.com (Markus Bordihn)
 */
var fs = require('fs-extra');
var https = require('https');
var path = require('path');
var querystring = require('querystring');

var buildTools = require('../../build_tools.js');


 /**
 * ClosureCompiler.
 * @constructor
 * @struct
 * @final
 */
var ClosureCompiler = function() {};


/**
 * @param {!string} files
 * @param {Object=} opt_params
 * @param {string=} opt_target_file
 */
ClosureCompiler.compile = function(files, opt_params, opt_target_file) {
  ClosureCompiler.localCompile(files, opt_params, opt_target_file);
  //ClosureCompiler.remoteCompile([], files, opt_target_file);
};


/**
 * @param {!string} files
 * @param {Object=} opt_options
 * @param {string=} opt_target_file
 * @param {function=} opt_callback
 */
ClosureCompiler.localCompile = function(files, opt_options, opt_target_file,
    opt_callback) {
  if (!files) {
    return;
  }

  var compiler = path.join(__dirname, '..', '..', 'resources',
    'closure-compiler', 'compiler.jar');
  var compilerOptions = [];
  var options = opt_options || {};

  // Compilation level
  if (!('compilation_level' in options)) {
    options.compilation_level = 'SIMPLE_OPTIMIZATIONS';
  }

  // Handling options
  for (var option in options) {
    compilerOptions.push('--' + option, options[option]);
  }

  // Handling files
  for (var i=0; i<files.length; i++) {
    compilerOptions.push('--js', files[i]);
  }

  var compilerEvent = function(error, stdout, stderr) {
    var code = stdout;
    var errors = error;
    var warnings = false;
    if (errors) {
      ClosureCompiler.error(errors);
      code = null;
    }

    if (opt_callback) {
      opt_callback(errors, warnings, opt_target_file, code);
    }
  };

  buildTools.execJavaJar(compiler, compilerOptions, compilerEvent);
};


/**
 * @param {!string} files
 * @param {Object=} opt_options
 * @param {string=} opt_target_file
 * @param {function=} opt_callback
 */
ClosureCompiler.remoteCompile = function(files, opt_options, opt_target_file,
    opt_callback) {
  // Handling options
  var unsupportedOptions = {
    'closure_entry_point': true
  };
  for (var option in opt_options) {
    if (option in unsupportedOptions) {
      var errorMsg = option + ' is unsupported by the closure-compiler ' + 
        'webservice!';
      ClosureCompiler.error(errorMsg);
      if (opt_callback) {
        opt_callback(errorMsg);
      }
      return;
    }
  }

  var data = {
    'compilation_level' : 'SIMPLE_OPTIMIZATIONS',
    'output_format': 'json',
    'output_info': ['compiled_code', 'warnings', 'errors', 'statistics']
  };

  var jsCode = '';
  for (var i=0; i<files.length; i++) {
    jsCode += fs.readFileSync(files[i]).toString();
  }
  if (jsCode) {
    data['js_code'] = jsCode;
  }

  var dataString = querystring.stringify(data);
  console.log('Data', dataString);

  var options = {
    host: 'closure-compiler.appspot.com',
    path: '/compile',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': dataString.length
    }
  };

  var request = https.request(options, function(response) {
    var data = '';
    response.setEncoding('utf8');
    response.on('data', function(chunk) {
      data += chunk;
    });
    response.on('end', function() {
      var result =  JSON.parse(data);
      var code = result.compiledCode;
      var errors = result.errors;
      var warnings = result.warnings;
      if (errors) {
        ClosureCompiler.error(errors);
        code = '';
      } else if (code) {
        code += '\n';
      }
      if (opt_callback) {
        opt_callback(errors, warnings, opt_target_file, code);
      }
      console.log('Result', result);
    });
  });

  request.on('error', function(e) {
    console.log('Problem with request:', e.message);
    if (opt_callback) {
      opt_callback(e.message);
    }
  });

  console.log(dataString);
  request.write(dataString);
  request.end();
};


/**
 * @param {string} msg
 */
ClosureCompiler.info = function(msg) {
  if (msg) {
    console.info('[Closure Compiler]', msg);
  }
};


/**
 * @param {string} msg
 */
ClosureCompiler.warn = function(msg) {
  console.error('[Closure Compiler Warn]', msg);
};


/**
 * @param {string} msg
 */
ClosureCompiler.error = function(msg) {
  console.error('[Closure Compiler Error]', msg);
};


module.exports = ClosureCompiler;