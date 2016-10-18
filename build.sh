#!/bin/sh

# develop: ./build.sh
# production: ./build.sh -O3 compact

set -e

for alias in 'emcc' 'emconfigure' 'emmake'; do
  # docker run -e 'EMCC_DEBUG=1' ...
  alias $alias="docker run -it --rm -m 2g -w='/home/src/ngspice-26' -v `pwd`:/home/src 42ua/emsdk $alias"
done
unset alias

if [ ! -d "ngspice-26" ]; then

  # minimal (develop version)
  git clone https://github.com/concord-consortium/ngspice.git ngspice-26
  cd ngspice-26
  git checkout ce4c0fb34a4c328e12aaebc1b34a67a7141e694b

  # full
  # curl -sL http://heanet.dl.sourceforge.net/project/ngspice/ng-spice-rework/26/ngspice-26.tar.gz | tar xz
  # cd ngspice-26
  # https://github.com/kripken/emscripten/issues/4540
  # git diff ngspice-26/src/spicelib/devices/bsim3soi_pd/b3soipddef.h > 4540.patch.diff
  patch -p1 < ../patches/4540.patch.diff

  # cd ngspice-26 && git diff src/frontend/terminal.c > ../patches/TIOCGWINSZ.patch.diff && cd -
  patch -p1 < ../patches/TIOCGWINSZ.patch.diff

  # cd ngspice-26 && git diff src/frontend/display.c > ../patches/EMCC_FN_PNTR.patch.diff && cd -
  patch -p1 < ../patches/EMCC_FN_PNTR.patch.diff

  # cd ngspice-26 && patch -p1 < ../patches/EMCC_PLOT.patch.diff && some modify && git add . && cd -
  # cd ngspice-26 && git diff src/frontend/plotting/Makefile.am src/frontend/display.c > ../patches/EMCC_PLOT.patch.diff && cd -
  patch -p1 < ../patches/EMCC_PLOT.patch.diff

  # cd ngspice-26 && git diff src/frontend/com_plot.c > ../patches/EM_Plot_redraw.patch.diff && cd -
  patch -p1 < ../patches/EM_Plot_redraw.patch.diff

  # configure

  ./autogen.sh

  emconfigure ./configure \
    --without-x \
    --disable-openmp --disable-shared \
    --prefix=/home/src/emcc-build

  sed -i '/#define HAVE__PROC_MEMINFO 1/d' src/include/ngspice/config.h
  sed -i 's!./ngmakeidx$(EXEEXT) -o ngspice.idx $(srcdir)/ngspice.txt!cp ngmakeidx$(EXEEXT) ngmakeidx$(EXEEXT).bc\n\temcc -O2 ngmakeidx$(EXEEXT).bc --pre-js ../../emcc-build/emcc-pre-node-fs.js -o ngmakeidx.js\n\tnode ngmakeidx$(EXEEXT).js -o ngspice.idx $(srcdir)/ngspice.txt!' src/Makefile

  mkdir -p ../emcc-build/

  echo '
    var Module = {};
    Module.preRun = function() {
      FS.mkdir("root");
      FS.mount(NODEFS, { root: "/" }, "root");
      FS.chdir("root/" + process.cwd());
    }' > ../emcc-build/emcc-pre-node-fs.js

  cd -

fi

mkdir -p emcc-build/

cp patches/em_plot.c patches/em_plot.h ngspice-26/src/frontend/plotting
emmake make clean
emmake make install CFLAGS="$1 -Werror -Wno-error=shift-negative-value -Wno-error=parentheses-equality -Wno-error=tautological-pointer-compare -Wno-absolute-value"

cd emcc-build/

rm -rf emcc_asset_dir/
cp -r share/ngspice emcc_asset_dir/
rm -r emcc_asset_dir/include
rm -r emcc_asset_dir/helpdir

cp bin/ngspice ngspice.bc

# https://palant.de/2016/02/05/compiling-c-to-javascript-emscripten-vs-cheerp
emcc $1 ../emcc-build/ngspice.bc \
  --preload-file ../emcc-build/emcc_asset_dir@/home/src/emcc-build/share/ngspice/ \
  --memory-init-file 0 \
  -s ASM_JS=2 \
  -s NO_EXIT_RUNTIME=1 \
  -o ../emcc-build/ngspice.js

if [ ! -d "node_env" ]; then
  nodeenv node_env --prebuilt
fi

. node_env/bin/activate

if [ ! -d "node_modules" ]; then
  npm i acorn escodegen estraverse escope
fi

cp ../yieldify.js yieldify.js

node --stack-size=10000 yieldify.js ngspice.js ../ui/ngspice.y.js $2

cd -

# clean global scope from asmjs vars
# cat /dev/urandom | tr -dc A-Za-z | head -c 42
{
  echo 'function ngspice_asmjs_fn(uOyhNleKslzjALEbUeSYCsPptSysoSINCxRBMsDlck){'
  echo '\tvar Module = uOyhNleKslzjALEbUeSYCsPptSysoSINCxRBMsDlck;'
  echo '\tvar window = {location: Module.yld_window.location, encodeURIComponent: Module.yld_window.encodeURIComponent, devicePixelRatio: Module.yld_window.devicePixelRatio};'
  echo '\tModule.preInit = function(){ Module.yld_asm = asm; Module.yld_SYSCALLS = SYSCALLS; Module.yld_pre_init(TTY, FS); };'
  sed 's/^/\t/' ui/ngspice.y.js
  echo '}'
} > ui/ngspice.f.y.js

# chown -R $USER emcc-build

# node ngspice.js