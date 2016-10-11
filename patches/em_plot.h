/*************
 * Header file for em_plot.c
 * Author: 2016 Oleg Mazko
 ************/

#ifndef ngspice_EM_PLOT_H
#define ngspice_EM_PLOT_H

disp_fn_Init_t             EM_Plot_Init;
disp_fn_NewViewport_t      EM_Plot_NewViewport;
disp_fn_Close_t            EM_Plot_Close;
disp_fn_DrawLine_t         EM_Plot_DrawLine;
disp_fn_Arc_t              EM_Plot_Arc;
disp_fn_Text_t             EM_Plot_Text;
disp_fn_DefineColor_t      EM_Plot_DefineColor;
disp_fn_DefineLinestyle_t  EM_Plot_DefineLinestyle;
disp_fn_SetLinestyle_t     EM_Plot_SetLinestyle;
disp_fn_SetColor_t         EM_Plot_SetColor;
disp_fn_Update_t           EM_Plot_Update;
disp_fn_Clear_t            EM_Plot_Clear;

int EM_Plot_Input(REQUEST *request, RESPONSE *response);

#endif
