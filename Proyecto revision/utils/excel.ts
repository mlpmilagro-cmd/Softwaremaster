import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import { db } from '../database';
import { Utils } from './helpers';
import type { CaseFile, Student, Teacher, PreventiveActivity, Representative, Course, PregnancyCase, AssistedClass, FollowUp } from '../database';

// Define colors for styling
const COLORS = {
    headerBlue: 'FF003366',
    columnHeaderBlue: 'FF1F4E78',
    textWhite: 'FFFFFFFF',
    borderGray: 'FFD9D9D9',
    priority: {
        Baja: 'FF92D050',
        Media: 'FFFFD966',
        Alta: 'FFFFC000',
        Crítica: 'FFFF0000',
    },
    assistedReturn: {
        soon: 'FFFF0000', // red <= 3 days
        medium: 'FFFFFF00', // yellow 7-14 days
        ok: 'FF92D050', // green > 2 weeks
    },
    lilacHeader: 'FF7030A0',
    greenAlternate: 'FFE2EFDA',
};

export class ExcelGenerator {
    private static async _createStyledWorksheet(title: string, mainHeaderColor: string = COLORS.headerBlue): Promise<{ wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet }> {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet(title.substring(0, 30));

        const institution = await db.institution.get(1);
        const headerText = institution?.name || 'Gestión del DECE';

        // Add a placeholder row for height
        ws.addRow([]);
        ws.mergeCells('A1:H1');
        const titleCell = ws.getCell('A1');
        titleCell.value = `${headerText} - ${title}`;
        titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.textWhite } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mainHeaderColor } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 30;

        return { wb, ws };
    }

    private static _applyHeaderStyles(row: ExcelJS.Row, color: string = COLORS.columnHeaderBlue) {
        row.eachCell(cell => {
            cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.textWhite } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: COLORS.borderGray } },
                left: { style: 'thin', color: { argb: COLORS.borderGray } },
                bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
                right: { style: 'thin', color: { argb: COLORS.borderGray } },
            };
        });
        row.height = 20;
    }

    private static _applyCellStyles(row: ExcelJS.Row, fillColor?: string) {
        row.eachCell(cell => {
            cell.font = { name: 'Calibri', size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: COLORS.borderGray } },
                left: { style: 'thin', color: { argb: COLORS.borderGray } },
                bottom: { style: 'thin', color: { argb: COLORS.borderGray } },
                right: { style: 'thin', color: { argb: COLORS.borderGray } },
            };
            if (fillColor) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
            }
        });
    }

    private static _autoFitColumns(ws: ExcelJS.Worksheet) {
        ws.columns.forEach(column => {
            let maxColumnLength = 0;
            if (column.values) {
                column.values.forEach(value => {
                    if (value) {
                         const cellLength = typeof value === 'object' && value.hasOwnProperty('richText')
                            ? (value as { richText: { text: string }[] }).richText.reduce((a, c) => a + c.text.length, 0)
                            : String(value).length;
                        if (cellLength > maxColumnLength) {
                            maxColumnLength = cellLength;
                        }
                    }
                });
            }
            column.width = Math.max(15, Math.min(50, maxColumnLength + 2));
        });
    }

    private static async _saveFile(wb: ExcelJS.Workbook, filename: string) {
        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `${filename}.xlsx`);
    }

    public static async exportCasesMatrix(data: any[]) {
        const { wb, ws } = await this._createStyledWorksheet("Matriz General de Casos");
        
        ws.getRow(1).getCell(1).value = `Gestión del DECE - Matriz General de Casos`;
        const headers = ["N°", "Estudiante", "Categoría", "Prioridad", "Estado", "Tutor", "Fecha Último Seguimiento"];
        const headerRow = ws.addRow(headers);
        this._applyHeaderStyles(headerRow);
        
        data.forEach(item => {
            const row = ws.addRow([item.n, item.student, item.category, item.priority, item.status, item.tutor, item.lastFollowUp]);
            const color = COLORS.priority[item.priority as keyof typeof COLORS.priority];
            this._applyCellStyles(row, color);
        });

        this._autoFitColumns(ws);
        await this._saveFile(wb, "Matriz_General_de_Casos");
    }

    public static async exportPreventiveActivities(data: PreventiveActivity[]) {
        const { wb, ws } = await this._createStyledWorksheet("Actividades Preventivas Ejecutadas");
        const headers = ["Fecha", "Temática", "Estudiantes", "Padres", "Docentes", "Autoridades", "Institución Cooperante"];
        const headerRow = ws.addRow(headers);
        this._applyHeaderStyles(headerRow, 'FF92D050');
        headerRow.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
        
        data.forEach((item, index) => {
            const audience = item.audience || [];
            const row = ws.addRow([
                Utils.formatDate(item.date),
                item.topic,
                audience.includes('Estudiantes') ? 'X' : '',
                audience.includes('Padres') ? 'X' : '',
                audience.includes('Docentes') ? 'X' : '',
                audience.includes('Autoridades') ? 'X' : '',
                item.cooperatingInstitution || 'N/A'
            ]);
            this._applyCellStyles(row, index % 2 === 0 ? undefined : COLORS.greenAlternate);
            row.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        this._autoFitColumns(ws);
        await this._saveFile(wb, "Actividades_Preventivas");
    }
    
    public static async exportAssistedClasses(data: (AssistedClass & {student?: Student, tutor?: Teacher})[]) {
        const { wb, ws } = await this._createStyledWorksheet("Matriz de Clases Asistidas");
        const headers = ["Estudiante", "Curso", "Tutor", "Motivo", "Plazo", "Fecha Retorno", "Estado"];
        const headerRow = ws.addRow(headers);
        this._applyHeaderStyles(headerRow);
        
        data.forEach(item => {
            const returnDate = new Date(item.tentativeReturnDate);
            const today = new Date();
            const diffDays = (returnDate.getTime() - today.getTime()) / (1000 * 3600 * 24);

            let color;
            let status;
            if (diffDays <= 3) { color = COLORS.assistedReturn.soon; status = 'Retorno Inminente'; }
            else if (diffDays <= 14) { color = COLORS.assistedReturn.medium; status = 'Próximo a Retornar'; }
            else { color = COLORS.assistedReturn.ok; status = 'A Tiempo'; }

            const row = ws.addRow([
                item.student?.fullName || 'N/A',
                item.student ? `${item.student.course} "${item.student.parallel}"` : 'N/A',
                item.tutor?.fullName || 'N/A',
                item.reason,
                item.permissionPeriod,
                Utils.formatDate(item.tentativeReturnDate),
                status
            ]);
            this._applyCellStyles(row, color);
        });

        this._autoFitColumns(ws);
        await this._saveFile(wb, "Matriz_Clases_Asistidas");
    }

    public static async exportPregnancyCases(data: (PregnancyCase & {student?: Student})[]) {
        const { wb, ws } = await this._createStyledWorksheet("Matriz de Embarazo-Maternidad-Paternidad", COLORS.lilacHeader);
        const headers = ["Estudiante", "Curso", "Meses Gestación", "Producto de Violencia", "Atención Médica", "Servicio de Salud", "Seguimiento"];
        const headerRow = ws.addRow(headers);
        this._applyHeaderStyles(headerRow, COLORS.lilacHeader);
        
        data.forEach(item => {
            const gestationMonths = item.pregnancyStartDate 
                ? Math.floor(((new Date()).getTime() - new Date(item.pregnancyStartDate).getTime()) / (1000 * 3600 * 24 * 30.44))
                : 'N/A';
            
            const row = ws.addRow([
                item.student?.fullName || 'N/A',
                item.student ? `${item.student.course} "${item.student.parallel}"` : 'N/A',
                gestationMonths,
                item.isFromViolence ? 'Sí' : 'No',
                item.receivesHealthCare !== 'Ninguna' ? 'Sí' : 'No',
                item.receivesHealthCare,
                item.relatedCaseId ? 'Sí' : 'No'
            ]);
            this._applyCellStyles(row);
        });
        this._autoFitColumns(ws);
        await this._saveFile(wb, "Matriz_Embarazos");
    }

    public static async generateStudentRosterTemplate() {
        const { wb, ws } = await this._createStyledWorksheet("Plantilla para Nómina de Estudiantes");
        const headers = ['cedula', 'fullName', 'course', 'parallel', 'representativeCedula', 'representativeName'];
        const headerRow = ws.addRow(headers);
        this._applyHeaderStyles(headerRow);
        
        const sampleData = [
            ['1234567890', 'APELLIDOS NOMBRES ESTUDIANTE', 'OCTAVO', 'A', '0987654321', 'APELLIDOS NOMBRES REPRESENTANTE'],
            ['1234567891', 'OTRO ESTUDIANTE APELLIDO', 'SEGUNDO BGU', 'C', '0987654322', 'OTRO REPRESENTANTE APELLIDO']
        ];

        sampleData.forEach(sample => {
            const row = ws.addRow(sample);
            this._applyCellStyles(row);
        });
        
        this._autoFitColumns(ws);
        await this._saveFile(wb, "plantilla_estudiantes");
    }

    public static async exportActorsList(data: any[], type: 'Estudiantes' | 'Docentes' | 'Representantes' | 'Cursos') {
        const { wb, ws } = await this._createStyledWorksheet(`Listado de ${type}`);
        let headers: string[] = [];
        
        if (type === 'Estudiantes') {
            headers = ["Nombre Completo", "Cédula", "Curso", "Paralelo", "Representante"];
        } else if (type === 'Docentes') {
            headers = ["Nombre Completo", "Cédula", "Email", "Teléfono", "Tutor de"];
        } else if (type === 'Representantes') {
            headers = ["Nombre Completo", "Cédula", "Teléfono", "Nº Estudiantes"];
        } else if (type === 'Cursos') {
            headers = ["Curso", "Paralelo", "Jornada"];
        }

        const headerRow = ws.addRow(headers);
        this._applyHeaderStyles(headerRow);
        
        data.forEach(item => {
            let rowData: any[] = [];
             if (type === 'Estudiantes') {
                rowData = [item.fullName, item.cedula, item.course, item.parallel, item.representativeName];
            } else if (type === 'Docentes') {
                rowData = [item.fullName, item.cedula, item.email, item.phone, item.tutorOfCourseName];
            } else if (type === 'Representantes') {
                rowData = [item.fullName, item.cedula, item.phone, item.studentCount];
            } else if (type === 'Cursos') {
                rowData = [item.name, item.parallel, item.jornada];
            }
            const row = ws.addRow(rowData);
            this._applyCellStyles(row);
        });

        this._autoFitColumns(ws);
        await this._saveFile(wb, `Listado_${type}`);
    }

    public static async generateGeneralStatisticsReport(data: { cases: CaseFile[], activities: PreventiveActivity[], followUps: FollowUp[] }) {
        const wb = new ExcelJS.Workbook();

        // Sheet 1: Cases by Category
        const wsCases = wb.addWorksheet("Casos por Categoría");
        const casesByCategory = data.cases.reduce((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        wsCases.addRow(["Categoría", "Total Casos"]);
        this._applyHeaderStyles(wsCases.getRow(1));
        Object.entries(casesByCategory).sort((a,b) => b[1] - a[1]).forEach(([category, count]) => {
            const row = wsCases.addRow([category, count]);
            this._applyCellStyles(row);
        });
        this._autoFitColumns(wsCases);

        // Sheet 2: Activities by Audience
        const wsActivities = wb.addWorksheet("Actividades por Audiencia");
        const activitiesByAudience = data.activities.reduce((acc, act) => {
            (act.audience || []).forEach(aud => {
                acc[aud] = (acc[aud] || 0) + 1;
            });
            return acc;
        }, {} as Record<string, number>);
         wsActivities.addRow(["Audiencia", "Nº Actividades Ejecutadas"]);
        this._applyHeaderStyles(wsActivities.getRow(1));
        Object.entries(activitiesByAudience).forEach(([audience, count]) => {
            const row = wsActivities.addRow([audience, count]);
            this._applyCellStyles(row);
        });
        this._autoFitColumns(wsActivities);

        // Sheet 3: Effective Follow-ups
        const wsFollowUps = wb.addWorksheet("Seguimientos Efectivos");
        wsFollowUps.addRow(["Total de Seguimientos Efectivos Registrados"]);
        wsFollowUps.mergeCells('A1:B1');
        this._applyHeaderStyles(wsFollowUps.getRow(1));
        const row = wsFollowUps.addRow([data.followUps.length]);
        wsFollowUps.mergeCells('A2:B2');
        this._applyCellStyles(row);
        row.font = { size: 14, bold: true };
        row.alignment = {horizontal: 'center'};

        await this._saveFile(wb, "Reporte_Estadistico_General");
    }

}