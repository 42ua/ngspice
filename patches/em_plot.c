/**********
Copyright 1990 Regents of the University of California.  All rights reserved.
Author: 2016 Oleg Mazko
**********/

/*
  Canvas plotting.
*/

#include "ngspice/ngspice.h"

#  include "ngspice/graph.h"
#  include "ngspice/ftedbgra.h"
#  include "ngspice/ftedev.h"
#  include "ngspice/fteinput.h"
#  include "ngspice/cpdefs.h"
#  include "ngspice/ftedefs.h"
#  include <variable.h>
#  include "../com_hardcopy.h"
#include "graf.h"


#include <emscripten.h>

#define FONT_HEIGHT 12

#define SOLID 0

typedef struct {
    bool isopen;
} EM_Info;

#define DEVDEP(g) (*((EM_Info *) (g)->devdep))

int
EM_Plot_SetLinestyle(int linestyleid);
int
EM_Plot_Clear(void);
int
EM_Plot_SetColor(int colorid);

int
EM_Plot_Init(void)
{
    dispdev->numlinestyles = 4;
    dispdev->numcolors = 20;

    EM_ASM(
      var devicePixelRatio = window.devicePixelRatio;
      if (devicePixelRatio) {
        try {
          var canvas = document.getElementById('ngspice_plot');
          var oldWidth = canvas.width;
          var oldHeight = canvas.height;
          canvas.style.width  = oldWidth + 'px';
          canvas.style.height = oldHeight + 'px';
          canvas.width = oldWidth * devicePixelRatio;
          canvas.height = oldHeight * devicePixelRatio;
          canvas.getContext('2d').scale(devicePixelRatio, devicePixelRatio);
        }
        catch (e){
          console.log(e);
        }            
      }
    );

    return (0);
}


/* NewViewport is responsible for filling in graph->viewport */
int
EM_Plot_NewViewport(GRAPH *graph)
{
    EM_ASM(
      document.getElementById('ngspice_plot').style.display = 'block';
    );

    dispdev->width = EM_ASM_INT_V({
        var canvas = document.getElementById('ngspice_plot');
        return parseInt(canvas.style.width, 10) || canvas.width;
    });

    dispdev->height = EM_ASM_INT_V({
        var canvas = document.getElementById('ngspice_plot');
        return parseInt(canvas.style.height, 10) || canvas.height;
    });

    if (graph->absolute.width) {
      // /* hardcopying from the scree,
      //    ie, we are passed a copy of an existing graph */
      internalerror("EM_Plot_NewViewport graph->absolute.width not implemented.");

      /* set to NULL so graphdb doesn't incorrectly de-allocate it */
      graph->devdep = NULL;

    } else {
        /* scale space */
        /* reasonable values, used in gr_ for placement */
        graph->fontwidth = (FONT_HEIGHT / 2) + 2;
        graph->fontheight = FONT_HEIGHT;

        EM_ASM_({
          document.getElementById('ngspice_plot').getContext('2d').font = $0 + 'px sans-serif';
        }, graph->fontheight);

        graph->absolute.width = dispdev->width;
        graph->absolute.height = dispdev->height;

        EM_Plot_Clear();

        graph->devdep = TMALLOC(EM_Info, 1);

        DEVDEP(graph).isopen = FALSE;
    }

    return (0);
}

void EM_Plot_redraw() {
  // try avoid infinite recursion (if any occurs in gr_redraw)
  if (!DEVDEP(currentgraph).isopen) {
    DEVDEP(currentgraph).isopen = TRUE;
    gr_redraw(currentgraph);
  }
}

int
EM_Plot_Close(void)
{
    EM_ASM(
      document.getElementById('ngspice_plot').style.display = 'none';
    );

    return 0;
}


int
EM_Plot_DrawLine(int x1, int y1, int x2, int y2)
{
    if (!DEVDEP(currentgraph).isopen) return 0;

    int linestyle = currentgraph->linestyle;
    if (currentgraph->currentcolor != 1){
      // solid if linestyle has color
      EM_Plot_SetLinestyle(SOLID);
    }

    EM_ASM_({
      var context = document.getElementById('ngspice_plot').getContext('2d');
      context.beginPath();
      context.moveTo($0, $1);
      context.lineTo($2, $3);
      context.stroke();
    }, x1, currentgraph->absolute.height - y1, x2, currentgraph->absolute.height - y2);

    EM_Plot_SetLinestyle(linestyle);

    return 0;
}

static void
linear_arc(int x0, int y0, int radius, double theta, double delta_theta)
/* x coordinate of center */
/* y coordinate of center */
/* radius of arc */
/* initial angle ( +x axis = 0 rad ) */
/* delta angle */
/*
 * Notes:
 *    Draws an arc of radius and center at (x0,y0) beginning at
 *    angle theta (in rad) and ending at theta + delta_theta
 */
{
    int x1, y1, x2, y2;
    int i, s = 60;
    double dphi;

    // test for negative delta
    // if (delta_theta < 0){
    //   return;
    // }

    x2 = x0 + (int) (radius * cos(theta));
    y2 = y0 + (int) (radius * sin(theta));

    dphi = delta_theta / s;

    for (i = 1; i <= s; i++) {
        x1 = x2;
        y1 = y2;
        x2 = x0 + (int)(radius * cos(theta + i*dphi));
        y2 = y0 + (int)(radius * sin(theta + i*dphi));
        EM_Plot_DrawLine(x1, y1, x2, y2);
    }
}

/*
 * Notes:
 *    Draws an arc of radius and center at (x0,y0) beginning at
 *    angle theta (in rad) and ending at theta + delta_theta
 */

// test: plot smithgrid n1
int
EM_Plot_Arc(int x0, int y0, int radius, double theta, double delta_theta)
{
    if (!DEVDEP(currentgraph).isopen) return 0;

    int linestyle = currentgraph->linestyle;
    if (currentgraph->currentcolor != 1){
      // solid if linestyle has color
      EM_Plot_SetLinestyle(SOLID);
    }

    // int c = rand() % 20;
    // EM_Plot_SetColor(c);
    // linear_arc(x0, y0, radius, theta, delta_theta);
    EM_ASM_({
      var context = document.getElementById('ngspice_plot').getContext('2d');
      context.beginPath();
      context.arc($0, $1, $2, -$3, -($3 + $4), $4 > 0);
      context.stroke();
    }, x0, currentgraph->absolute.height - y0, radius, theta, delta_theta);

    EM_Plot_SetLinestyle(linestyle);

    return 0;
}


/* note: x and y are the LOWER left corner of text */
int
EM_Plot_Text(char *text, int x, int y)
{
    if (!DEVDEP(currentgraph).isopen) return 0;

    EM_ASM_({
      var context = document.getElementById('ngspice_plot').getContext('2d');
      // http://www.w3schools.com/tags/canvas_textbaseline.asp
      context.textBaseline = "middle";
      var text = Module.Pointer_stringify($0);
      context.fillText(text, $1, $2);
    }, text, x, currentgraph->absolute.height - y - (FONT_HEIGHT / 2));
    return 0;
}


int
EM_Plot_DefineColor(int colorid, double red, double green, double blue)
{
    internalerror("EM_Plot_DefineColor not implemented.");
    return 0;
}


int
EM_Plot_DefineLinestyle(int linestyleid, int mask)
{
    internalerror("EM_Plot_DefineLinestyle not implemented.");
    return 0;
}


int
EM_Plot_SetLinestyle(int linestyleid)
{
    if (linestyleid < 0 || linestyleid > dispdev->numlinestyles) {
        internalerror("bad linestyleid");
        return 0;
    }

    if (currentgraph->linestyle != linestyleid) {

        currentgraph->linestyle = linestyleid;

        EM_ASM_({
          var context = document.getElementById('ngspice_plot').getContext('2d');

          switch ($0) {
            case 1:
              context.setLineDash([1,5]); // dotted 
              break;
            case 2:
              context.setLineDash([10,5]); // longdashed 
              break;
            case 3:
              context.setLineDash([5,10]); // shortdashed 
              break;
            case 4:
              context.setLineDash([5]); // equal 
              break;
            default:
              console.log('EM_Plot_SetLinestyle ? ' + $0);
            case $1:
              context.setLineDash([]); // solid
              break;
          }
        }, linestyleid, SOLID);
    }

    return 0;
}


int
EM_Plot_SetColor(int colorid)
{
    if (currentgraph->currentcolor != colorid) {

      if (colorid == 0) {
        internalerror("EM_Plot_SetColor black color black background ?");
      }

      currentgraph->currentcolor = colorid;

      EM_ASM_({
        var context = document.getElementById('ngspice_plot').getContext('2d');
        context.strokeStyle = ([
          'black', 
          'white', 'red', 'blue',
          'orange', 'green', 'pink',
          'brown', 'khaki', 'plum',
          'orchid', 'violet', 'maroon',
          'turquoise', 'sienna', 'coral',
          'cyan', 'magenta', 'gold',
          'yellow'][$0]);
      }, colorid); 
    }

    return 0;
}


int
EM_Plot_Update(void)
{
 
    return 0;
}


int
EM_Plot_Clear(void)
{
    EM_ASM_({
        var context =  document.getElementById('ngspice_plot').getContext('2d');
        context.beginPath();
        context.rect(0, 0, $0, $1);
        context.fillStyle = 'black';
        context.fill();
        // text color
        context.fillStyle = 'white';
      }, currentgraph->absolute.width, currentgraph->absolute.height);
    return 0;
}

int
EM_Plot_Input(REQUEST *request, RESPONSE *response)
{

    return 0;
}