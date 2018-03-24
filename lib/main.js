'use strict';

$(function () {

  $(".ngsice_toolbar input[value='gist']").click(function() {
    // alert(Module.yld_FS.cwd());
    var files = Module.yld_FS.readdir('.');
    files = files.filter(v => Module.yld_FS.isFile(
        Module.yld_FS.stat(v).mode)
    );
    // http://stackoverflow.com/q/12710001/
    function Uint8ToString(u8a){
      var CHUNK_SZ = 0x8000;
      var c = [];
      for (var i=0; i < u8a.length; i+=CHUNK_SZ) {
        c.push(String.fromCharCode.apply(null, u8a.subarray(i, i+CHUNK_SZ)));
      }
      return c.join('');
    }
    files = files.reduce(
      (p, c) => Object.assign(p, {
        [c]: {content: btoa(Uint8ToString(Module.yld_FS.readFile(c)))}
      }),
      {stdin: {content: jqconsole.GetHistory().join('\n')}});

    $.ajax({
      type: "POST",
      url: 'https://api.github.com/gists',
      headers: {
        "Authorization": 'Basic cHJvaW90OjYyMGQ0NDFjMGU5MWNmYjBlY2MwMzk3MjM3MjkxNzM2ZDcwNDA2ZGE=',
      },
      data: JSON.stringify({
        "description": "ngspice.js",
        "files": files
      })
    }).done(function(response) {
      var url = response.html_url,
          my = $(location).attr('href').replace(/(#|\?).*$/, "") + '?gist=' + response.id;
      $(".em_files_list").empty().append(
        "<strong>GIST:</strong> <a href='" + url + "'>" + response.id + "</a> | " +
        "<strong>Share:</strong> <a href='" + my + "'>me</a>"
      );
    }).fail(function( e ) {
      console.log(e);
      $(".em_files_list").empty().append("GIST POST: " + e.status + " | " + e.statusText);
    });

  });

  $(".ngsice_toolbar input[value='ls']").click(function() {
    // alert(Module.yld_FS.cwd());
    var files = Module.yld_FS.readdir('.');
    files = files.filter(v => Module.yld_FS.isFile(
        Module.yld_FS.stat(v).mode)
    );
    files.reduce(
      (p, c, i) => (i ? p.append(' | ') : p).append(
        $("<a />", {
            href : "#",
            text : c,
        }).click(function() {
          var name = $( this ).text(),
              data = Module.yld_FS.readFile(name);
          // https://bgrins.github.io/videoconverter.js/
          $( this ).attr({
            href: URL.createObjectURL(new Blob([data])),
            download: name
          });
        })), 
      $(".em_files_list").empty()
    );
  });

  $(".ngsice_toolbar input[type='file']").change(function(evt) {
    var files = evt.target.files; // FileList object
    for (var file of files) {
      var reader = new FileReader();
      // Closure to capture the file information.
      reader.onload = (function(theFile) {
        return function(e) {
          var contents = e.target.result;
          // try {
          //   Module.FS_unlink('/home/NGUser/' + theFile.name);
          // } catch (e){
          //   console.log(e);
          // }
          // var data = [].slice.call(new Uint8Array(contents));
          // https://bgrins.github.io/videoconverter.js/
          try {
            Module.FS_createDataFile(
              '/home/NGUser',
              theFile.name,
              new Uint8Array(contents),
              true,
              true
            );
          } catch (e) {
            console.log(e);
            $(".em_files_list").empty().append(e.toString());
          }
        };
      })(file);
      reader.readAsArrayBuffer(file);
    }
  });

  var jqconsole = $('#console').jqconsole('','');
  var jqconsole_gist_stdin = [];
  var Module = {};

  Module.arguments = [];

  Module.yld_window = window;

  var assert_resolved = null;
  var assert_prompt_watchdog = 0;
  var prompt_data = null;

  function* get_stdin_promise () {
    if (assert_resolved === false) {
      var err = new Error('Blocking stdin recursion ?');
      console.error(err);
      alert(err);
      // throw err;
    }

    if (++assert_prompt_watchdog > 1000) {
      var err = new Error('Infinite stdin loop ?');
      console.error(err);
      alert(err);
      // throw err;
    }

    if (prompt_data === null) {
      assert_prompt_watchdog = 0;
      if (jqconsole_gist_stdin.length){
        prompt_data = jqconsole_gist_stdin.shift();
        jqconsole.Write(prompt_data + '\n', 'jqconsole-input');
      } else {
        assert_resolved = false;
        yield new Promise(function(resolve, reject) {
          jqconsole.Prompt(true, function (data) {
              prompt_data = data;
              assert_resolved = true;
              resolve();
          }); 
        });
      }
    }
  }

  Module.yld_api = {
    ___syscall3: function* (which, varargs) {
      Module.yld_SYSCALLS.varargs = varargs;
      try {
          var fd = Module.yld_SYSCALLS.getStreamFromFD().fd;
          if (fd !== 0) {
              throw new Error('ASSERT: Not stdin (0) ? -> ' + fd);
          } else {
              yield* get_stdin_promise();
          }
      } catch (e) {
          console.warn(e);
      }
      return Module.asmLibraryArg.___syscall3.apply(null, arguments);
    },
    ___syscall145: function* (which, varargs) {
      Module.yld_SYSCALLS.varargs = varargs;
      try {
          var fd = Module.yld_SYSCALLS.getStreamFromFD().fd;
          if (fd !== 0) {
              //throw new Error('ASSERT: Not stdin (0) ? -> ' + fd);
          } else {
              yield* get_stdin_promise();
          }
      } catch (e) {
          console.warn(e);
      }
      return Module.asmLibraryArg.___syscall145.apply(null, arguments);
    },

    // ASM JS LOOPBACK START

    invoke_vi: function* (index, a1) {
      try {
          yield * Module.yld_asm.yld_export["dynCall_vi"](index, a1);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iiii: function* (index, a1, a2, a3) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iiii"](index, a1, a2, a3);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_vii: function* (index, a1, a2) {
      try {
          yield * Module.yld_asm.yld_export["dynCall_vii"](index, a1, a2);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_d: function* (index) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_d"](index);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_i: function* (index) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_i"](index);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iiiiiiiiii: function* (index, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iiiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8, a9);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iiiiiii: function* (index, a1, a2, a3, a4, a5, a6) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iiiiiii"](index, a1, a2, a3, a4, a5, a6);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_ii: function* (index, a1) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_ii"](index, a1);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iidiii: function* (index, a1, a2, a3, a4, a5) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iidiii"](index, a1, a2, a3, a4, a5);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_viii: function* (index, a1, a2, a3) {
      try {
          yield * Module.yld_asm.yld_export["dynCall_viii"](index, a1, a2, a3);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_v: function* (index) {
      try {
          yield * Module.yld_asm.yld_export["dynCall_v"](index);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iiiiiiiii: function* (index, a1, a2, a3, a4, a5, a6, a7, a8) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iiiiiiiii"](index, a1, a2, a3, a4, a5, a6, a7, a8);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iiiii: function* (index, a1, a2, a3, a4) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iiiii"](index, a1, a2, a3, a4);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iiiiii: function* (index, a1, a2, a3, a4, a5) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iiiiii"](index, a1, a2, a3, a4, a5);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_viiii: function* (index, a1, a2, a3, a4) {
      try {
          yield * Module.yld_asm.yld_export["dynCall_viiii"](index, a1, a2, a3, a4);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iii: function* (index, a1, a2) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iii"](index, a1, a2);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    },
    invoke_iiiidd: function* (index, a1, a2, a3, a4, a5) {
      try {
          return yield * Module.yld_asm.yld_export["dynCall_iiiidd"](index, a1, a2, a3, a4, a5);
      } catch (e) {
          if (typeof e !== 'number' && e !== 'longjmp')
              throw e;
          Module.yld_asm["setThrew"](1, 0);
      }
    }

    // ASM JS LOOPBACK END
  };

  Module.yld_pre_init = function(TTY, FS) {
    Module.yld_FS = FS;
    Module.yld_FS.createFolder('/home', 'NGUser', true, true);
    Module.yld_FS.chdir('/home/NGUser');

    Module._main = function() {
      function execute(generator, yieldValue) {
        var next = generator.next(yieldValue);
        if (!next.done) {
          next.value.then(
            result => execute(generator, result),
            err => generator.throw(err)
          );
        } else {
          // real exit status code here
          console.log('main() generator done ' + next.value);
        }
      }
      execute( Module.yld_asm.yld_export._main.apply(null, arguments) );
    }

    // cat /proc/tty/drivers
    // https://github.com/kripken/emscripten/issues/4366
    // fix isatty() fails if just override Module[stdout]

    // cat /proc/tty/drivers
    // stdin
    TTY.ttys[FS.makedev(5, 0)].ops.get_char = function (tty) {
      if (!tty.input.length) {
        if (prompt_data === null) {
          return null;
        }
        tty.input = Module['intArrayFromString'](prompt_data + '\n', true);
      }
      var result = tty.input.shift();
      if (!tty.input.length) {
        prompt_data = null;
      }
      return result;
    };

    // stdout
    TTY.ttys[FS.makedev(5, 0)].ops.put_char = function (tty, val) {
      jqconsole.Write(Module['UTF8ArrayToString']([val], 0));
    }
    // stderr
    TTY.ttys[FS.makedev(6, 0)].ops.put_char = function (tty, val) {
      jqconsole.Write(
        Module['UTF8ArrayToString']([val], 0),
        'jqconsole-stderr');
    }
  };

  /* Gist load or default */

  (function() {
    function getParameterByName(name, url) {
      try {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
      } catch (e) {
        console.log(e);
      }
    }

    // http://localhost:8000/?gist=3839054076a3efc8ecde26e4e8933a2a

    var gistId = getParameterByName('gist');

    if (gistId) {
      $.get( 'https://api.github.com/gists/' + gistId)
      .done(function( data ) {
        jqconsole_gist_stdin = data.files['stdin'].content.split('\n');
        jqconsole.SetHistory(jqconsole_gist_stdin);
        ngspice_asmjs_fn(Module);
        Object.keys(data.files).sort().forEach(function (key) {
          if (key !== 'stdin') {
            var content = data.files[key].content;
            if (key.startsWith && key.startsWith('show-img')){
              $('.show_images_list').append($("<img />", {
                src : "data:image/png;base64," + content,
                alt: key
              }));
            }
            try {
              Module.FS_createDataFile(
                '/home/NGUser',
                key,
                atob(content).split('').map(c => c.charCodeAt(0)),
                true,
                true
              );
            } catch (e) {
              console.log(e);
              $(".em_files_list").empty().append(e.toString());
            }            
          }
        });
      })
      .fail(function( e ) {
        $(".em_files_list").empty().append("GIST GET: " + e.status + " | " + e.statusText);
      });      
    } else {
      ngspice_asmjs_fn(Module);
    }

  })();

});