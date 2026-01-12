import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../database';
import type { 
    Institution, Student, Representative, CaseFile, FollowUp, AssistedClass, Teacher, Course, Appointment, PreventiveActivity,
    EducandoEnFamilia,
    PregnancyCase,
    SexualViolenceCaseDetails,
    SexualViolenceVictim,
    DeceFollowUpForm,
    User
} from '../database';
import { Utils } from './helpers';
import { DECE_FORM_QUESTIONS } from './constants';
import { STUDENT_INTERVIEW_QUESTIONS, TEACHER_INTERVIEW_QUESTIONS, REPRESENTATIVE_INTERVIEW_QUESTIONS } from './interviewQuestions';
import type Dexie from 'dexie';

const PEF_CRITERIA_TEXT = [
    "1. Manifiesta una comprensión básica de los lineamientos y objetivos del Programa Educando en Familia (ideas fuerza).",
    "2. Conoce en detalle el proceso metodológico de implementación del Programa.",
    "3. Muestra entendimiento del enfoque con el cual se aborda el eje temático que corresponda.",
    "4. Muestra predisposición para participar en el Programa.",
    "5. Promueve entre las familias del grupo de estudiantes a cargo, la participación y planificación de la campaña correspondiente al módulo en ejecución.",
    "6. Lidera la realización del taller con familias, es decir, comunica con oportunidad a madres y padres, dispone de los materiales y recursos técnicos y evidencia una preparación adecuada en el manejo de la agenda.",
    "7. Realiza la preparación del Encuentro comunitario y jornada de intercambio.",
    "8. Presenta la ficha de evaluación del taller con familias oportunamente al DECE."
];

const MARGINS = {
    top: 25,
    bottom: 25,
    left: 30,
    right: 30,
};

export const PdfGenerator = {
    _applyBackground: (doc: any, bgBase64?: string) => {
        if (!bgBase64) return;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        try {
            doc.addImage(bgBase64, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        } catch (e) {
            console.error("Failed to add background image to PDF", e);
        }
    },
    
    _generatePdfHeader: (doc: any, institution: Institution | undefined, title: string) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const centerX = pageWidth / 2;
        let currentY = MARGINS.top - 15;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(institution?.district || '', centerX, currentY, { align: 'center' });
        currentY += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(institution?.name || 'Institución Educativa', centerX, currentY, { align: 'center' });
        currentY += 8;
        
        doc.setFontSize(12);
        doc.setTextColor(80);
        doc.text(title, centerX, currentY, { align: 'center' });
        
        doc.setTextColor(0);
        return currentY + 15;
    },

    _generatePdfFooter: (doc: any) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(`Generado: ${Utils.formatDate(new Date())}`, MARGINS.left, pageHeight - MARGINS.bottom + 5);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth - MARGINS.right - 15, pageHeight - MARGINS.bottom + 5);
        }
    },

    _renderJustifiedText: (doc: jsPDF, text: string, y: number, options?: { indent?: number }): number => {
        const { indent = 0 } = options || {};
        const pageWidth = doc.internal.pageSize.getWidth();
        const maxWidth = pageWidth - (MARGINS.left + MARGINS.right) - indent;
        const lines = doc.splitTextToSize(text, maxWidth);
        
        doc.text(lines, MARGINS.left + indent, y, { align: 'justify', maxWidth: maxWidth });
        
        const lineHeight = doc.getLineHeight() / doc.internal.scaleFactor;
        return y + (lines.length * lineHeight);
    },

    _generateSignatureBlock: (doc: jsPDF, y: number, name: string, title: string, align: 'left' | 'center' | 'right' = 'left') => {
        const signatureLineWidth = 70;
        let xPos = MARGINS.left;
        if (align === 'center') {
            xPos = doc.internal.pageSize.getWidth() / 2 - signatureLineWidth / 2;
        } else if (align === 'right') {
            xPos = doc.internal.pageSize.getWidth() - MARGINS.right - signatureLineWidth;
        }

        let currentY = y;
        doc.line(xPos, currentY, xPos + signatureLineWidth, currentY);
        currentY += 5;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(name, xPos, currentY);
        currentY += 5;
        doc.text(title, xPos, currentY);
        return currentY + 5;
    },

    generateCitationPdf: async (appointment: Appointment) => {
        const institution = await db.institution.get(1);
        const user = await db.users.get(appointment.responsibleUserId);
        let attendee;
        if (appointment.attendeeType === 'Estudiante') {
            attendee = await db.students.get(appointment.attendeeId);
        } else if (appointment.attendeeType === 'Representante') {
            attendee = await db.representatives.get(appointment.attendeeId);
        } else {
            attendee = await db.teachers.get(appointment.attendeeId);
        }
        
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;

        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);

        const startY = PdfGenerator._generatePdfHeader(doc, institution, "CITACIÓN");

        doc.setFontSize(11);
        doc.text(`Fecha: ${Utils.formatDate(new Date())}`, doc.internal.pageSize.getWidth() - MARGINS.right, startY - 15, { align: 'right' });

        let currentY = startY;
        doc.text(`Sr(a): ${attendee?.fullName || 'N/A'}`, MARGINS.left, currentY);
        doc.text(`Presente.-`, MARGINS.left, currentY + 7);
        currentY += 20;

        const bodyText = `Por medio de la presente, se le convoca a una reunión en el Departamento de Consejería Estudiantil (DECE) de esta institución, el día ${Utils.formatDate(appointment.date)} a las ${appointment.startTime}h, para tratar asuntos relacionados con ${appointment.reason}.`;
        currentY = PdfGenerator._renderJustifiedText(doc, bodyText, currentY);
        currentY += 10;
        currentY = PdfGenerator._renderJustifiedText(doc, "Su presencia es de suma importancia para el bienestar y desarrollo integral del/la estudiante.", currentY);
        currentY += 20;
        doc.text("Atentamente,", MARGINS.left, currentY);
        
        currentY += 20;
        PdfGenerator._generateSignatureBlock(doc, currentY, user?.nombreCompleto || '', user?.cargo || 'Profesional DECE');

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Citacion_${attendee?.fullName.replace(/ /g, '_')}.pdf`);
    },

    generateReportPdf: async (title: string, columns: string[], body: any[][], filterText: string) => {
        const institution = await db.institution.toCollection().first();
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();
        
        const startY = PdfGenerator._generatePdfHeader(doc, institution, title);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(`Filtros aplicados: ${filterText}`, MARGINS.left, startY);

        const safeBody = body.map(row => row.map(cell => cell ?? 'N/A'));

        autoTable(doc, {
            startY: startY + 5,
            head: [columns],
            body: safeBody,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { 
                fillColor: [7, 89, 133],
                textColor: 255,
                fontStyle: 'bold',
            },
            alternateRowStyles: { fillColor: [240, 240, 240] },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: () => addBackgroundToPage(),
        });
        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Reporte_${title.replace(/ /g, '_')}.pdf`);
    },
    
    generateStudentProfilePdf: async (student: Student, representative: Representative | undefined, cases: CaseFile[]) => {
        const institution = await db.institution.toCollection().first();
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();
        
        let startY = PdfGenerator._generatePdfHeader(doc, institution, 'Ficha de Datos Estudiantil');
        
        if (student.photoBase64) {
            try { doc.addImage(student.photoBase64, 'JPEG', MARGINS.left, startY, 40, 40); }
            catch(e) { console.error("Error adding student photo to PDF", e); }
        }

        const studentData = [
            ['Nombre:', student.fullName],
            ['Cédula:', student.cedula],
            ['Nacimiento:', `${Utils.formatDate(student.birthDate)} (${Utils.calculateAge(student.birthDate).display})`],
            ['Género:', student.gender],
            ['Curso:', `${student.course} "${student.parallel}"`],
        ];
        if (student.specialCondition) {
            studentData.push(['Condición:', student.specialCondition]);
        }

        autoTable(doc, {
            startY: startY,
            body: studentData,
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } },
            margin: { left: MARGINS.left + 45 },
            willDrawPage: addBackgroundToPage,
        });
        let lastY = (doc as any).lastAutoTable?.finalY;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Datos del Representante Legal", MARGINS.left, lastY + 10);

        const repData = [
            ['Nombre:', representative?.fullName || 'N/A'],
            ['Cédula:', representative?.cedula || 'N/A'],
            ['Teléfono:', representative?.phone || 'N/A'],
            ['Dirección:', representative?.address || 'N/A'],
        ];

        autoTable(doc, {
            startY: lastY + 15,
            body: repData,
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } },
            margin: { left: MARGINS.left },
            willDrawPage: addBackgroundToPage,
        });
        lastY = (doc as any).lastAutoTable?.finalY;

        if (cases && cases.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text("Casos Asociados", MARGINS.left, lastY + 10);
            autoTable(doc, {
                startY: lastY + 15,
                head: [['Código', 'Categoría', 'Prioridad', 'Estado', 'Fecha Apertura']],
                body: cases.map(c => [c.code, Utils.getSafeCategoryName(c.category), c.priority, c.status, Utils.formatDate(c.openingDate)]),
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 9 },
                headStyles: { fillColor: [7, 89, 133], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [240, 240, 240] },
                margin: { left: MARGINS.left, right: MARGINS.right },
                willDrawPage: addBackgroundToPage,
            });
        }

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Ficha_${student.fullName.replace(/ /g, '_')}.pdf`);
    },

    generateStudentHistoryPdf: async (student: Student, representative: Representative | undefined, cases: CaseFile[], allFollowUps: Map<number, FollowUp[]>) => {
        const institution = await db.institution.toCollection().first();
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);

        addBackgroundToPage();
        let currentY = PdfGenerator._generatePdfHeader(doc, institution, `Historial Completo - ${student.fullName}`);
        
        if (student.photoBase64) {
            try { doc.addImage(student.photoBase64, 'JPEG', MARGINS.left, currentY, 30, 30); }
            catch(e) { console.error("Error adding student photo to PDF", e); }
        }

        const studentDetails = [
            [`Nombre:`, student.fullName],
            [`Cédula:`, student.cedula],
            [`Nacimiento:`, `${Utils.formatDate(student.birthDate)} (${Utils.calculateAge(student.birthDate).display})`],
            [`Curso:`, `${student.course} "${student.parallel}"`],
        ];
        autoTable(doc, {
            startY: currentY,
            body: studentDetails,
            theme: 'plain',
            styles: { font: 'helvetica', cellPadding: 1, fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            margin: { left: MARGINS.left + 35 },
            willDrawPage: addBackgroundToPage,
        });
        currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 5;

        const repDetails = [
            [`Representante:`, representative?.fullName ?? 'N/A'],
            [`Teléfono Rep.:`, representative?.phone ?? 'N/A'],
        ];
        autoTable(doc, {
            startY: currentY,
            body: repDetails,
            theme: 'plain',
            styles: { font: 'helvetica', cellPadding: 1, fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold' } },
            margin: { left: MARGINS.left },
            willDrawPage: addBackgroundToPage,
        });
        currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 5;
        
        doc.line(MARGINS.left, currentY, doc.internal.pageSize.getWidth() - MARGINS.right, currentY);
        currentY += 10;

        if (!cases || cases.length === 0) {
            doc.text("No hay casos registrados para este estudiante.", MARGINS.left, currentY);
        } else {
            cases.forEach((c, index) => {
                const caseHeader = [
                    [`Código:`, c.code],
                    [`Categoría:`, Utils.getSafeCategoryName(c.category)],
                    [`Prioridad:`, c.priority],
                    [`Estado:`, c.status],
                    [`Fecha Apertura:`, Utils.formatDate(c.openingDate)],
                ];
                
                const caseBody = `Descripción: ${c.description || 'Sin descripción.'}`;
                const followUpsForCase = allFollowUps.get(c.id!)?.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];
                const followUpsHeight = followUpsForCase.length > 0 ? (followUpsForCase.length + 1) * 8 + 10 : 0;
                
                const descLines = doc.splitTextToSize(caseBody, doc.internal.pageSize.getWidth() - MARGINS.left - MARGINS.right);
                const tableHeight = (caseHeader.length * 6) + descLines.length * 4 + 20 + followUpsHeight;

                if (currentY + tableHeight > doc.internal.pageSize.getHeight() - MARGINS.bottom) {
                    doc.addPage();
                    addBackgroundToPage();
                    currentY = MARGINS.top;
                }

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`Expediente de Caso #${index + 1}`, MARGINS.left, currentY);
                currentY += 2;

                autoTable(doc, {
                    startY: currentY,
                    body: caseHeader,
                    theme: 'plain',
                    styles: { font: 'helvetica', fontSize: 9, cellPadding: 0.5 },
                    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } },
                    margin: { left: MARGINS.left },
                    willDrawPage: addBackgroundToPage,
                });
                currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 2;

                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                currentY = PdfGenerator._renderJustifiedText(doc, caseBody, currentY + 4);
                
                if (followUpsForCase.length > 0) {
                    currentY += 2;
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Seguimientos:', MARGINS.left, currentY);
                    
                    autoTable(doc, {
                        startY: currentY + 2,
                        head: [['Fecha', 'Descripción del Seguimiento', 'Responsable']],
                        body: followUpsForCase.map(f => [Utils.formatDate(f.date), f.description ?? 'N/A', f.responsible ?? 'N/A']),
                        theme: 'striped',
                        styles: { font: 'helvetica', fontSize: 8 },
                        headStyles: { fillColor: [100, 116, 139], textColor: 255, fontStyle: 'bold' },
                        margin: { left: MARGINS.left, right: MARGINS.right },
                        didDrawPage: (data: any) => { currentY = data.cursor.y; },
                        willDrawPage: addBackgroundToPage,
                    });
                    currentY = (doc as any).lastAutoTable?.finalY ?? currentY;
                }
                 currentY += 10;
            });
        }

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Historial_${student.fullName.replace(/ /g, '_')}.pdf`);
    },
    
    generateFollowUpHistoryPdf: async (caseFile: CaseFile, student: Student, followUps: FollowUp[]) => {
        const institution = await db.institution.get(1);
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const doc = new jsPDF();

        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bgSetting?.value);

        addBackgroundToPage();
        let currentY = PdfGenerator._generatePdfHeader(doc, institution, `Historial de Seguimientos - Caso ${caseFile.code}`);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Estudiante: ${student.fullName}`, MARGINS.left, currentY);
        currentY += 10;
        
        const followUpBody = followUps.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(f => [
            Utils.formatDate(f.date),
            f.description || 'N/A',
            f.observations || 'N/A',
            f.responsible || 'N/A'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Fecha', 'Actividad', 'Observaciones', 'Responsable']],
            body: followUpBody,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { fillColor: [7, 89, 133], textColor: 255, fontStyle: 'bold' },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Historial_Seguimientos_${caseFile.code}.pdf`);
    },
    
    generateStudentFollowUpsPdf: async (student: Student, representative: Representative | undefined, followUps: FollowUp[], courseInfo: Course | undefined) => {
        const institution = await db.institution.toCollection().first();
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);

        addBackgroundToPage();
        let currentY = PdfGenerator._generatePdfHeader(doc, institution, `Reporte de Seguimientos`);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Estudiante: ${student.fullName}`, MARGINS.left, currentY);
        currentY += 10;
        
        const studentData = [
            ['Cédula:', student.cedula ?? 'N/A'],
            ['Curso:', `${student.course ?? 'N/A'} "${student.parallel ?? 'N/A'}"`],
            ['Jornada:', courseInfo?.jornada ?? 'N/A'],
        ];
        autoTable(doc, {
            startY: currentY,
            body: studentData,
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } },
            margin: { left: MARGINS.left },
            willDrawPage: addBackgroundToPage,
        });
        currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 5;

        const repData = [
            ['Representante:', representative?.fullName ?? 'N/A'],
            ['Teléfono Rep.:', representative?.phone ?? 'N/A'],
        ];
        autoTable(doc, {
            startY: currentY,
            body: repData,
            theme: 'plain',
            styles: { font: 'helvetica', fontSize: 10 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 } },
            margin: { left: MARGINS.left },
            willDrawPage: addBackgroundToPage,
        });
        currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 10;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Historial de Seguimientos", MARGINS.left, currentY);

        const followUpBody = followUps.map(f => [
            Utils.formatDate(f.date),
            f.description || 'N/A',
            f.observations || 'N/A',
            f.responsible || 'N/A'
        ]);

        autoTable(doc, {
            startY: currentY + 5,
            head: [['Fecha', 'Actividad', 'Observaciones', 'Responsable']],
            body: followUpBody,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 9 },
            headStyles: { fillColor: [7, 89, 133], textColor: 255, fontStyle: 'bold' },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Seguimientos_${student.fullName.replace(/ /g, '_')}.pdf`);
    },

    generateInformedConsentPdf: async (caseFile: CaseFile, student: Student, representative: Representative | undefined, teacher: Teacher | undefined, course: Course | undefined) => {
        const userIdStr = sessionStorage.getItem('currentUser');
        if (!userIdStr) throw new Error("User not found in session.");
        const user = await db.users.get(Number(userIdStr));
        if (!user) throw new Error("User not found in database.");

        const institution = await db.institution.get(1);
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();

        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL", doc.internal.pageSize.getWidth() / 2, MARGINS.top, { align: 'center' });
        doc.text("CONSENTIMIENTO INFORMADO PARA LA ATENCIÓN PSICOSOCIAL", doc.internal.pageSize.getWidth() / 2, MARGINS.top + 10, { align: 'center' });

        autoTable(doc, {
            startY: MARGINS.top + 15,
            theme: 'grid',
            head: [['Datos Informativos Generales']],
            headStyles: { fillColor: [221, 221, 221], textColor: 0, fontStyle: 'bold' },
            body: [],
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable?.finalY,
            theme: 'grid',
            body: [
                [{ content: 'Institución educativa:', styles: { fontStyle: 'bold' } }, institution?.name || '', { content: 'Año lectivo:', styles: { fontStyle: 'bold' } }, institution?.schoolYear || ''],
                [{ content: 'Nombre del o la estudiante:', styles: { fontStyle: 'bold', colSpan: 3 } }, student.fullName],
                [{ content: 'Curso y paralelo:', styles: { fontStyle: 'bold' } }, `${student.course} "${student.parallel}"`, { content: 'Jornada:', styles: { fontStyle: 'bold' } }, course?.jornada || ''],
                [{ content: 'Teléfono del representante:', styles: { fontStyle: 'bold' } }, representative?.phone || '', { content: 'Fecha:', styles: { fontStyle: 'bold' } }, Utils.formatDate(new Date())],
            ],
            styles: { fontSize: 9 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            didParseCell: (data) => {
                if (data.row.index === 1 && data.column.index === 1) {
                    data.cell.colSpan = 3;
                }
            },
            willDrawPage: addBackgroundToPage,
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable?.finalY,
            theme: 'grid',
            head: [['Consentimiento Informado']],
            headStyles: { fillColor: [221, 221, 221], textColor: 0, fontStyle: 'bold' },
            body: [],
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        
        let currentY = ((doc as any).lastAutoTable?.finalY ?? 40) + 5;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        
        const text1 = `Yo, ${representative?.fullName || '....................................................................'}, con CI ${representative?.cedula || '..........................'}, en calidad de representante legal del/la estudiante ${student.fullName}, una vez que he conocido en que consiste el proceso de atención psicosocial que ejecuta el personal del Departamento de Consejería Estudiantil de la institución educativa,`;
        currentY = PdfGenerator._renderJustifiedText(doc, text1, currentY);
        currentY += 5;

        doc.text("AUTORIZO (   ) NO AUTORIZO (   ), que mi representado/a cuente con este servicio, en razón de que", MARGINS.left, currentY);
        currentY += 5;
        doc.line(MARGINS.left, currentY, doc.internal.pageSize.getWidth() - MARGINS.right, currentY);
        currentY += 5;
        doc.line(MARGINS.left, currentY, doc.internal.pageSize.getWidth() - MARGINS.right, currentY);
        currentY += 5;
        doc.line(MARGINS.left, currentY, doc.internal.pageSize.getWidth() - MARGINS.right, currentY);
        currentY += 15;

        const text2 = "A su vez, declaro haber sido informado/a que el servicio de atención y acompañamiento psicosocial no consiste en un proceso de evaluación y/o terapia psicológica y que en caso de requerirlo mi representado/a podría ser derivado a un centro de atención externa a la institución educativa que brinde dicho servicio.";
        currentY = PdfGenerator._renderJustifiedText(doc, text2, currentY);
        
        currentY = doc.internal.pageSize.getHeight() - MARGINS.bottom - 70;

        autoTable(doc, {
            startY: currentY,
            theme: 'grid',
            head: [['Firmas']],
            headStyles: { fillColor: [221, 221, 221], textColor: 0, fontStyle: 'bold' },
            body: [],
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 25;

        PdfGenerator._generateSignatureBlock(doc, currentY, user?.nombreCompleto || '', user?.cargo || 'Profesional DECE', 'left');
        PdfGenerator._generateSignatureBlock(doc, currentY, representative?.fullName || '', 'Padre/madre/representante legal', 'right');
        
        currentY += 30;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        PdfGenerator._renderJustifiedText(doc, "La información registrada en este documento es confidencial y de uso exclusivo del Departamento de Consejería Estudiantil.", currentY);

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Consentimiento_${student.fullName.replace(/ /g, '_')}.pdf`);
    },

    generateObservationSheetPdf: async (caseFile: CaseFile, student: Student, user: User) => {
        const institution = await db.institution.get(1);
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();

        const addHeader = (title: string) => {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text("DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL", doc.internal.pageSize.getWidth() / 2, MARGINS.top, { align: 'center' });
            doc.text(title, doc.internal.pageSize.getWidth() / 2, MARGINS.top + 8, { align: 'center' });
        };
        
        addHeader("FICHA DE OBSERVACIÓN");

        autoTable(doc, {
            startY: MARGINS.top + 15,
            theme: 'grid',
            body: [
                [{ content: 'Datos Informativos Generales', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [221, 221, 221], textColor: 0 } }],
                [{ content: `Institución Educativa: ${institution?.name || ''}`, styles: { fontStyle: 'bold' } }, { content: `Año lectivo: ${institution?.schoolYear || ''}`, styles: { fontStyle: 'bold' } }],
                [{ content: `Apellidos y nombres del o la estudiante: ${student.fullName}`, colSpan: 2, styles: { fontStyle: 'bold' } }],
                [{ content: 'Duración de la observación:', styles: { fontStyle: 'bold' } }, ''],
                [{ content: 'Observación áulica:', styles: { fontStyle: 'bold' } }, { content: 'Observación en otros espacios externos al aula:', styles: { fontStyle: 'bold' } }],
            ],
            styles: { fontSize: 9 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        const questions1 = [
            "¿Se evidencian conductas de agresividad?", "Se evidencia llanto frágil o tendencia a llorar?", "¿Se evidencia falta de adecuación al grupo?", "¿Se evidencia desmotivación y o decaimiento?",
            "¿Se evidencian frecuentes cambios de actitud?", "¿Se evidencian dificultades de relacionamiento con sus compañeros/as de aula?",
            "¿Se identifican problemas para concertarse probablemente por problemas emocionales?", "¿Se evidencia dificultad de gestionar sus emociones?",
            "¿Se evidencia somnolencia durante las clases?", "¿Se evidencian dificultades de relacionarse con sus docente?",
            "¿Se evidencia dificultad de resolver conflictos?", "¿Se evidencia extrema sensibilidad?", "¿Se identifican conductas de riesgo?",
            "¿Se aísla y no comparte actividades con su compañeros/as?", "¿Se evidencia falta de participación en las actividades?",
            "¿Se observaron otras conductas que requieren atención? ¿Cuál o cuáles?", "¿Se observaron algunas conductas con mayor frecuencia? ¿Cuál o cuáles?"
        ];

        const body1 = questions1.map(q => [q, '', '', '']);
        
        autoTable(doc, {
            startY: ((doc as any).lastAutoTable?.finalY ?? 40) + 5,
            head: [['PREGUNTAS PARA RESPONDER DURANTE LA OBSERVACIÓN', 'SI', 'NO', 'Comentario']],
            headStyles: { fillColor: [221, 221, 221], textColor: 0, fontStyle: 'bold', halign: 'center' },
            body: body1,
            theme: 'grid',
            styles: { fontSize: 9 },
            columnStyles: { 1: { cellWidth: 10 }, 2: { cellWidth: 10 }, 3: { cellWidth: 50 } },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        doc.addPage();
        addBackgroundToPage();
        addHeader("FICHA DE OBSERVACIÓN (Continuación)");

        const questions2 = [
            "¿A partir de la observación se identifica que él o la estudiante posiblemente requiere una atención psicosocial de parte del Departamento de Consejería Estudiantil?",
            "¿A partir de la observación se identifica que él o la estudiante posiblemente requiere una atención distinta a la psicosocial? Por ejemplo: evaluación psicopedagogía; valoración de lenguaje, valoración médica"
        ];
        const body2 = questions2.map(q => [q, '', '', '']);
        
        autoTable(doc, {
            startY: MARGINS.top + 20,
            head: [['PREGUNTAS PARA IDENTIFCAR LOS POSIBLES TIPOS DE ATENCIÓN REQUERIDA', 'SI', 'NO', 'Detalle del tipo de intervención requerida si la respuesta es SÍ']],
            headStyles: { fillColor: [221, 221, 221], textColor: 0, fontStyle: 'bold', halign: 'center' },
            body: body2,
            theme: 'grid',
            styles: { fontSize: 9 },
            columnStyles: { 1: { cellWidth: 10 }, 2: { cellWidth: 10 }, 3: { cellWidth: 50 } },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        
        const derivarText = "Inspección ( )\nDpto. Inclusión ( )\nDpto. médico ( )\nOtro ( ) ¿Cuál? ____________";
        const derivarText2 = "Centro de atención médica ( )\nCentro de atención psicológica ( )\nUDAI ( )\nOtro ( ) ¿Cuál?";

        autoTable(doc, {
            startY: ((doc as any).lastAutoTable?.finalY ?? 40) + 5,
            head: [['PREGUNTAS QUE GUÍAN A IDENTIFCAR LA NECESIDAD DE DERIVAR ESTUDIANTES PARA LA ATENCIÓN CON OTRAS INSTANCIAS', 'SI', 'NO', 'Seleccione solo cuando la respuesta es SÍ']],
            headStyles: { fillColor: [221, 221, 221], textColor: 0, fontStyle: 'bold', halign: 'center' },
            body: [
                ['¿Se requiere derivar al estudiante a un departamento o unidad interna a la institución educativa?', '', '', derivarText],
                ['¿Se requiere derivar al estudiante a una entidad u organización externa a la institución?', '', '', derivarText2]
            ],
            theme: 'grid',
            styles: { fontSize: 9, minCellHeight: 20 },
            columnStyles: { 1: { cellWidth: 10 }, 2: { cellWidth: 10 }, 3: { cellWidth: 50 } },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        let currentY = ((doc as any).lastAutoTable?.finalY ?? 40) + 20;
        PdfGenerator._generateSignatureBlock(doc, currentY, user.nombreCompleto, user.cargo || 'Profesional DECE');

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Ficha_Observacion_${student.fullName.replace(/ /g, '_')}.pdf`);
    },

    generateReferralPdf: async (caseFile: CaseFile, student: Student, representative: Representative | undefined, teacher: Teacher | undefined, course: Course | undefined) => {
        const userIdStr = sessionStorage.getItem('currentUser');
        if (!userIdStr) throw new Error("User not found in session.");
        const user = await db.users.get(Number(userIdStr));
        if (!user) throw new Error("User not found in database.");

        const VIOLENCE_CATEGORIES = ['Violencia Física', 'Violencia Psicológica', 'Violencia Sexual', 'Acoso Escolar (Bullying)'];
        if (VIOLENCE_CATEGORIES.includes(caseFile.category)) {
            await PdfGenerator.generateInterinstitutionalReferralPdf(caseFile, student, representative, user);
        } else {
            await PdfGenerator.generateStandardReferralPdf(caseFile, student, representative, teacher, course, user);
        }
    },
    
    generateStandardReferralPdf: async (caseFile: CaseFile, student: Student, representative: Representative | undefined, teacher: Teacher | undefined, course: Course | undefined, user: User) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);
        doc.text("Ficha de Derivación Estándar - EN CONSTRUCCIÓN", MARGINS.left, MARGINS.top);
        doc.save(`Derivacion_Estandar_${student.fullName.replace(/ /g, '_')}.pdf`);
    },
    
    generateInterinstitutionalReferralPdf: async (caseFile: CaseFile, student: Student, representative: Representative | undefined, user: User) => {
        const institution = await db.institution.get(1);
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("FICHA DE DERIVACIÓN INTERINSTITUCIONAL", doc.internal.pageSize.getWidth() / 2, MARGINS.top - 15, { align: 'center' });
    
        const headStyles = { fontStyle: 'bold', fillColor: [224, 224, 224], textColor: 0, lineWidth: 0.1, lineColor: 100 };
        const fieldLabelStyle = { fontStyle: 'bold', cellWidth: 45 };
        let lastY = MARGINS.top;
    
        // 1. DATOS INSTITUCIÓN INTERNA
        autoTable(doc, {
            startY: lastY,
            head: [[{ content: '1. DATOS INSTITUCIÓN INTERNA', colSpan: 4, styles: { ...headStyles, halign: 'left' } }]],
            body: [
                [{ content: 'Fecha:', styles: fieldLabelStyle }, Utils.formatDate(new Date()), { content: 'Cartera de Estado:', styles: fieldLabelStyle }, 'MINEDUC'],
                [{ content: 'Coordinación zonal:', styles: fieldLabelStyle }, institution?.coordinacionZonal || '', { content: 'Distrito:', styles: fieldLabelStyle }, institution?.district || ''],
                [{ content: 'Provincia:', styles: fieldLabelStyle }, institution?.provincia || '', { content: 'Cantón:', styles: fieldLabelStyle }, institution?.canton || ''],
                [{ content: 'Institución educativa:', styles: fieldLabelStyle }, { content: institution?.name || '', colSpan: 3 }],
                [{ content: 'Datos de la persona responsable de la derivación', colSpan: 4, styles: { fontStyle: 'bold', minCellHeight: 8, valign: 'middle' } }],
                [{ content: 'Nombres y Apellidos:', styles: fieldLabelStyle }, user.nombreCompleto, { content: 'Cargo:', styles: fieldLabelStyle }, user.cargo || ''],
                [{ content: 'Correo:', styles: fieldLabelStyle }, user.correo, { content: 'Teléfono:', styles: fieldLabelStyle }, user.telefono || ''],
            ],
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 1.5 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        lastY = (doc as any).lastAutoTable.finalY;

        // 2. DATOS INSTITUCIÓN EXTERNA
        const serviceMap = {
            'Consulta Externa': ['Violencia Física', 'Violencia Sexual', 'Ideación/Intento de suicidio'].includes(caseFile.category),
            'Emergencia': caseFile.category === 'Ideación/Intento de suicidio',
            'Atención Psicológica': ['Violencia Psicológica', 'Violencia Sexual', 'Acoso Escolar (Bullying)', 'Ideación/Intento de suicidio', 'Conflictos familiares'].includes(caseFile.category),
            'Asesoría Legal': ['Violencia Física', 'Violencia Psicológica', 'Violencia Sexual'].includes(caseFile.category),
            'Acompañamiento social': ['Situación de vulnerabilidad económica', 'Conflictos familiares', 'Embarazo/ maternidad/ paternidad adolescente'].includes(caseFile.category)
        };
    
        autoTable(doc, {
            startY: lastY + 3,
            head: [[{ content: '2. DATOS INSTITUCIÓN EXTERNA', colSpan: 3, styles: { ...headStyles, halign: 'left' } }]],
            body: [
                [{ content: 'Cartera de Estado', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                [
                    '( X ) Ministerio de Salud Pública', 
                    '(  ) Ministerio de Inclusión Económica y Social', 
                    '(  ) Secretaría de Derechos Humanos'
                ],
                [{ content: 'Servicio Requerido', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [240, 240, 240] } }],
                [
                    `( ${serviceMap['Consulta Externa'] ? 'X' : ' '} ) Consulta Externa`, 
                    `(  ) Transferencias monetarias`, 
                    `( ${serviceMap['Atención Psicológica'] ? 'X' : ' '} ) Atención Psicológica`
                ],
                [
                    `( ${serviceMap['Emergencia'] ? 'X' : ' '} ) Emergencia`, 
                    `(  ) Centro de Desarrollo Infantil`, 
                    `( ${serviceMap['Asesoría Legal'] ? 'X' : ' '} ) Asesoría Legal`
                ],
                ['', '', `( ${serviceMap['Acompañamiento social'] ? 'X' : ' '} ) Acompañamiento social`],
            ],
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 1.5 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        lastY = (doc as any).lastAutoTable.finalY;
    
        // 3. DATOS DE LA PERSONA DERIVADA
        autoTable(doc, {
            startY: lastY + 3,
            head: [[{ content: '3. DATOS DE LA PERSONA DERIVADA', colSpan: 4, styles: { ...headStyles, halign: 'left' } }]],
            body: [
                [{ content: 'Nombres y apellidos:', styles: fieldLabelStyle }, student.fullName, { content: 'Tipo de documento de identidad:', styles: fieldLabelStyle }, 'Cédula'],
                [{ content: 'Sexo:', styles: fieldLabelStyle }, student.gender, { content: 'Número de documento de identidad:', styles: fieldLabelStyle }, student.cedula],
                [{ content: 'Fecha de nacimiento:', styles: fieldLabelStyle }, Utils.formatDate(student.birthDate), { content: 'Edad:', styles: fieldLabelStyle }, Utils.calculateAge(student.birthDate).display],
                [{ content: 'Movilidad humana:', styles: fieldLabelStyle }, '', { content: 'Discapacidad:', styles: fieldLabelStyle }, student.specialCondition || 'No'],
                [{ content: 'Nombres y apellidos de la persona adulta de contacto:', styles: fieldLabelStyle }, { content: representative?.fullName || '', colSpan: 3 }],
                [{ content: 'Relación con la persona derivada:', styles: fieldLabelStyle }, 'Representante Legal', { content: 'Tipo de documento de identidad:', styles: fieldLabelStyle }, 'Cédula'],
                [{ content: 'Correo electrónico:', styles: fieldLabelStyle }, '', { content: 'Número de documento de identidad:', styles: fieldLabelStyle }, representative?.cedula || ''],
                [{ content: 'Dirección domiciliaria:', styles: fieldLabelStyle }, { content: representative?.address || '', colSpan: 3 }],
            ],
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 1.5 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        lastY = (doc as any).lastAutoTable.finalY;
        
        // Situaciones de vulnerabilidad
        const vulnerabilityMap: { [key: string]: boolean } = {
            'Niña o adolescente embarazada': caseFile.category === 'Embarazo/ maternidad/ paternidad adolescente',
            'Violencia física': caseFile.category === 'Violencia Física',
            'Violencia por omisión o negligencia': false, // No category for this
            'Violencia sexual': caseFile.category === 'Violencia Sexual',
            'Violencia psicológica': caseFile.category === 'Violencia Psicológica',
            'Víctima indirecta de femicidio': false, // No category
            'Intento autolítico o ideación suicida': caseFile.category === 'Ideación/Intento de suicidio',
            'Uso y consumo de Alcohol, tabaco y otras drogas': caseFile.category === 'Consumo de alcohol, tabaco y/o drogas',
            'Migración riesgosa o forzada trata y tráfico de persona': false, // No category
            'Trabajo infantil, mendicidad y/o situación de pobreza o pobreza extrema': caseFile.category === 'Situación de vulnerabilidad económica',
        };
    
        autoTable(doc, {
            startY: lastY + 3,
            head: [[{ content: 'Situaciones de vulnerabilidad destacadas', colSpan: 2, styles: { ...headStyles, halign: 'left' } }]],
            body: [
                [`( ${vulnerabilityMap['Niña o adolescente embarazada'] ? 'X' : ' '} ) Niña o adolescente embarazada`, `( ${vulnerabilityMap['Violencia sexual'] ? 'X' : ' '} ) Violencia sexual`],
                [`( ${vulnerabilityMap['Violencia física'] ? 'X' : ' '} ) Violencia física`, `( ${vulnerabilityMap['Violencia psicológica'] ? 'X' : ' '} ) Violencia psicológica`],
                [`( ${vulnerabilityMap['Violencia por omisión o negligencia'] ? 'X' : ' '} ) Violencia por omisión o negligencia`, `( ${vulnerabilityMap['Víctima indirecta de femicidio'] ? 'X' : ' '} ) Víctima indirecta de femicidio`],
                [`( ${vulnerabilityMap['Intento autolítico o ideación suicida'] ? 'X' : ' '} ) Intento autolítico o ideación suicida`, `( ${vulnerabilityMap['Migración riesgosa o forzada trata y tráfico de persona'] ? 'X' : ' '} ) Migración riesgosa o forzada trata y tráfico de persona`],
                [`( ${vulnerabilityMap['Uso y consumo de Alcohol, tabaco y otras drogas'] ? 'X' : ' '} ) Uso y consumo de Alcohol, tabaco y otras drogas`, `( ${vulnerabilityMap['Trabajo infantil, mendicidad y/o situación de pobreza o pobreza extrema'] ? 'X' : ' '} ) Trabajo infantil, mendicidad y/o situación de pobreza o pobreza extrema`],
                ['( ) Otros', ''],
            ],
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 1.5 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        lastY = (doc as any).lastAutoTable.finalY;
    
        // Observaciones
        autoTable(doc, {
            startY: lastY,
            body: [[{ content: `Observaciones:\n\n${caseFile.description}`, styles: { fontStyle: 'normal', minCellHeight: 40, valign: 'top' } }]],
            theme: 'grid',
            styles: { fontSize: 8.5, cellPadding: 1.5 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
    
        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Derivacion_${student.fullName.replace(/ /g, '_')}.pdf`);
    },

    generateMspReferralPdf: async (caseFile: CaseFile, student: Student, representative: Representative | undefined, teacher: Teacher | undefined, course: Course | undefined) => {
        const institution = await db.institution.get(1);
        const mspAuthoritySetting = await db.settings.get('mspAuthority');
        const mspAuthority = mspAuthoritySetting?.value || {};
        const user = await db.users.get(Number(sessionStorage.getItem('currentUser')));
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;

        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);
        
        let currentY = MARGINS.top;
        
        doc.setFontSize(11);
        doc.text(`${mspAuthority.city || institution?.canton || 'Ciudad'}, ${Utils.formatDate(new Date())}`, doc.internal.pageSize.getWidth() - MARGINS.right, currentY, { align: 'right' });
        currentY += 15;

        doc.setFont('helvetica', 'bold');
        doc.text(mspAuthority.name || "___________________________", MARGINS.left, currentY);
        currentY += 5;
        doc.text(mspAuthority.position || "DIRECTOR/A DISTRITAL", MARGINS.left, currentY);
        currentY += 5;
        doc.text(`${mspAuthority.district || '__________________'} - SALUD`, MARGINS.left, currentY);
        currentY += 5;
        doc.text(mspAuthority.city || "Ciudad", MARGINS.left, currentY);
        currentY += 15;

        doc.setFont('helvetica', 'normal');
        doc.text("De mi consideración.-", MARGINS.left, currentY);
        currentY += 15;

        const body1 = `Por medio del presente, en calidad de Autoridad institucional de la ${institution?.name} y en pleno cumplimiento al MAIS-CE adjunto al presente la FICHA DE DERIVACIÓN realizada por la profesional DECE ${user?.nombreCompleto}, en el cual se detalla la situación y necesidad de atención integral en salud del estudiante ${student.fullName} del ${student.course} de la jornada ${course?.jornada}.`;
        currentY = PdfGenerator._renderJustifiedText(doc, body1, currentY);
        currentY += 10;
        
        const body2 = `Adicional, con el objetivo de garantizar su adecuado agendamiento, describo la dirección exacta del domicilio de la estudiante y referente familiar Sra. ${representative?.fullName} – CI. ${representative?.cedula} (mamá) Telf. ${representative?.phone}.`;
        currentY = PdfGenerator._renderJustifiedText(doc, body2, currentY);
        currentY += 15;
        
        doc.text("Particular que comunico para los fines pertinentes.", MARGINS.left, currentY);
        currentY += 30;
        doc.text("Atentamente,", MARGINS.left, currentY);
        
        currentY += 20;
        PdfGenerator._generateSignatureBlock(doc, currentY, institution?.authority || '', `Rector/a ${institution?.name || ''}`);

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Oficio_MSP_${student.fullName.replace(/ /g, '_')}.pdf`);
    },
    generateTutorNotificationPdf: async (item: CaseFile | AssistedClass, student: Student, tutor: Teacher, user: User) => {
        const institution = await db.institution.get(1);
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);

        const startY = PdfGenerator._generatePdfHeader(doc, institution, "NOTIFICACIÓN A DOCENTE TUTOR");

        let currentY = startY;
        doc.setFontSize(11);
        doc.text(`Fecha: ${Utils.formatDate(new Date())}`, doc.internal.pageSize.getWidth() - MARGINS.right, currentY, { align: 'right' });
        currentY += 10;
        doc.text(`Para: ${tutor.fullName}`, MARGINS.left, currentY);
        doc.text(`De: ${user.nombreCompleto}`, MARGINS.left, currentY + 7);
        doc.text(`Asunto: Notificación sobre el estudiante ${student.fullName}`, MARGINS.left, currentY + 14);
        currentY += 30;

        let body = '';
        if ('category' in item) { // It's a CaseFile
            body = `Se notifica que el estudiante ${student.fullName} del curso ${student.course} "${student.parallel}", presenta un caso de ${Utils.getSafeCategoryName(item.category)} que requiere especial atención y seguimiento de su parte. Se solicita mantener comunicación constante con el DECE.`;
        } else { // It's an AssistedClass
            body = `Se notifica que el estudiante ${student.fullName} del curso ${student.course} "${student.parallel}", se acogerá a la modalidad de clases asistidas por un período de ${item.permissionPeriod}, con fecha tentativa de retorno el ${Utils.formatDate(item.tentativeReturnDate)}. El motivo es: ${item.reason}. Se solicita brindar el apoyo pedagógico necesario.`;
        }

        currentY = PdfGenerator._renderJustifiedText(doc, body, currentY);
        currentY += 30;
        doc.text("Atentamente,", MARGINS.left, currentY);
        currentY += 20;
        PdfGenerator._generateSignatureBlock(doc, currentY, user.nombreCompleto, user.cargo || 'Profesional DECE');

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Notificacion_Tutor_${student.fullName.replace(/ /g, '_')}.pdf`);
    },
    generateDailySchedulePdf: async (date: Date, appointments: (Appointment & { attendeeName: string })[]) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();

        const institution = await db.institution.get(1);
        const startY = PdfGenerator._generatePdfHeader(doc, institution, `Agenda del Día - ${Utils.formatDate(date)}`);

        if (appointments.length === 0) {
            doc.text("No hay citas programadas para este día.", MARGINS.left, startY);
        } else {
            const body = appointments
                .sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''))
                .map(app => [app.startTime, app.attendeeName, app.attendeeType, app.reason]);
            
            autoTable(doc, {
                startY: startY,
                head: [['Hora', 'Asistente', 'Tipo', 'Motivo']],
                body: body,
                willDrawPage: addBackgroundToPage,
            });
        }
        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Agenda_${Utils.formatDate(date)}.pdf`);
    },
    generateActivityReportPdf: async (activities: PreventiveActivity[], periodLabel: string) => {
        await PdfGenerator.generateReportPdf(
            `Plan de Actividades Preventivas - ${periodLabel}`,
            ['Fecha', 'Tema', 'Descripción', 'Audiencia'],
            activities.map(a => [Utils.formatDate(a.date), a.topic, a.description || 'N/A', (a.audience || []).join(', ')]),
            `Período: ${periodLabel}`
        );
    },
    generateAttendanceCertificatePdf: async (data: { representativeName: string; representativeCedula: string; date: string; startTime: string; endTime: string; }) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);

        const institution = await db.institution.get(1);
        const user = await db.users.get(Number(sessionStorage.getItem('currentUser')));
        
        const startY = PdfGenerator._generatePdfHeader(doc, institution, "CERTIFICADO DE ASISTENCIA");
        
        let currentY = startY + 20;
        const text = `Por medio del presente se certifica que ${data.representativeName || '...........................................'}, con C.I. ${data.representativeCedula || '..................'}, representante legal del/la estudiante, asistió a la convocatoria realizada por el Departamento de Consejería Estudiantil el día ${Utils.formatDate(data.date)}, en el horario de ${data.startTime}h a ${data.endTime}h.`;
        currentY = PdfGenerator._renderJustifiedText(doc, text, currentY);
        currentY += 15;
        currentY = PdfGenerator._renderJustifiedText(doc, "Se extiende el presente certificado para los fines que estime conveniente.", currentY);
        currentY += 20;
        doc.text("Atentamente,", MARGINS.left, currentY);
        
        currentY += 20;
        PdfGenerator._generateSignatureBlock(doc, currentY, user?.nombreCompleto || '', user?.cargo || 'Profesional DECE');
        
        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Certificado_${data.representativeName.replace(/ /g, '_')}.pdf`);
    },
    generatePefReportPdf: async (reportBody: (string | number)[][]) => {
        await PdfGenerator.generateReportPdf("Reporte de Cumplimiento PEF", ['CÉDULA', 'APELLIDOS Y NOMBRES', 'FECHA INICIO', 'FECHA FIN'], reportBody, "Docentes con 30 horas cumplidas");
    },
    generateEvaluationPdf: async (evaluation: EducandoEnFamilia, teacher: Teacher) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();

        const lightBlue = [220, 237, 250]; // Light blue color for header

        // 1. Main Header
        autoTable(doc, {
            startY: MARGINS.top - 15,
            body: [
                ['PROGRAMA EDUCANDO EN FAMILIA (PeF)'],
                ['Ficha de evaluación y aprobación por módulo ejecutado'],
            ],
            theme: 'grid',
            styles: {
                fontSize: 10,
                halign: 'center',
                fontStyle: 'bold',
                fillColor: lightBlue,
                textColor: 0,
            },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        // 2. Info Table
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            body: [
                [{ content: 'Nombre del docente:', styles: { fontStyle: 'bold' } }, teacher.fullName, { content: 'C.C:', styles: { fontStyle: 'bold' } }, teacher.cedula],
                [{ content: 'Nombre del módulo:', styles: { fontStyle: 'bold' } }, { content: evaluation.moduleName, colSpan: 3 }],
            ],
            theme: 'grid',
            styles: { fontSize: 9 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        // 3. Instruction
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Para completar la presente ficha marque con una X si ha observado criterios que se describe a continuación:', MARGINS.left, (doc as any).lastAutoTable.finalY + 5);

        // 4. Criteria Table
        const criteriaBody = PEF_CRITERIA_TEXT.map((text, index) => {
            const isMet = evaluation.criteriaMet[index];
            return [
                { content: `${index + 1}.`, styles: { halign: 'center' } },
                text,
                { content: isMet ? 'X' : '', styles: { halign: 'center' } },
                { content: !isMet ? 'X' : '', styles: { halign: 'center' } },
            ];
        });

        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [[
                { content: '' }, // Empty for number column
                { content: 'Observo:', styles: { halign: 'center', fontStyle: 'bold' } },
                { content: 'SI', styles: { halign: 'center', fontStyle: 'bold' } },
                { content: 'NO', styles: { halign: 'center', fontStyle: 'bold' } }
            ]],
            body: criteriaBody,
            theme: 'grid',
            styles: { fontSize: 9, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 8 },
                2: { cellWidth: 10 },
                3: { cellWidth: 10 },
            },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        // 5. Calificación / Observaciones
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            body: [
                [{ content: 'Calificación:', styles: { fontStyle: 'bold' } }, `${evaluation.score}/8`],
                [{ content: 'Observaciones:', styles: { fontStyle: 'bold', valign: 'top' } }, ''],
            ],
            theme: 'grid',
            styles: { fontSize: 9 },
            rowStyles: {
                1: { minCellHeight: 30 },
            },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });

        // 6. Footer Note
        const footerText = "Cada criterio tiene una valoración de un 1 punto. Para obtener la aprobación de se considerara 6 puntos afirmativos que dará la oportunidad de estar dentro de la matriz para la recategorización. En caso de que no cumpla con los criterios, el docente liderará el proceso de balance con sus compañeros docentes, DECE y autoridad sobre la ejecución del módulo correspondiente, logros y dificultades.";
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            body: [[footerText]],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
        });
        
        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Evaluacion_PEF_${teacher.fullName.replace(/ /g, '_')}.pdf`);
    },
    generatePermissionSlipPdf: async (type: 'Maternidad' | 'Lactancia', pCase: PregnancyCase, student: Student) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);

        const institution = await db.institution.get(1);
        const user = await db.users.get(Number(sessionStorage.getItem('currentUser')));
        const startY = PdfGenerator._generatePdfHeader(doc, institution, `Notificación de Permiso por ${type}`);
        
        let startDate = type === 'Maternidad' ? pCase.maternityLeaveStartDate : pCase.lactationLeaveStartDate;
        let endDate = type === 'Maternidad' ? pCase.maternityLeaveEndDate : pCase.lactationLeaveEndDate;

        let text = `Se notifica que la estudiante ${student.fullName} del curso ${student.course} "${student.parallel}" hará uso de su permiso por ${type.toLowerCase()} desde el ${Utils.formatDate(startDate!)} hasta el ${Utils.formatDate(endDate!)}. Se solicita a los docentes tomar las medidas de apoyo pedagógico correspondientes.`;
        let currentY = PdfGenerator._renderJustifiedText(doc, text, startY);
        currentY += 20;
        doc.text("Atentamente,", MARGINS.left, currentY);
        currentY += 20;
        PdfGenerator._generateSignatureBlock(doc, currentY, user?.nombreCompleto || '', user?.cargo || 'Profesional DECE');

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Permiso_${type}_${student.fullName.replace(/ /g, '_')}.pdf`);
    },
    generatePregnancyCasesReportPdf: async (cases: (PregnancyCase & { student?: Student })[]) => {
        await PdfGenerator.generateReportPdf(
            'Reporte de Casos de Embarazo/Maternidad',
            ['Estudiante', 'Curso', 'F.P.P.', 'Fecha Nacimiento', 'Riesgo'],
            cases.map(c => [
                c.student?.fullName || 'N/A',
                c.student ? `${c.student.course} "${c.student.parallel}"` : 'N/A',
                Utils.formatDate(c.estimatedDueDate),
                Utils.formatDate(c.birthDate),
                c.isHighRisk ? 'Sí' : 'No'
            ]),
            "Todos los registros"
        );
    },
    generateFlexibilityNotificationPdf: async (item: PregnancyCase, student: Student, tutor: Teacher | undefined) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);

        const institution = await db.institution.get(1);
        const user = await db.users.get(Number(sessionStorage.getItem('currentUser')));
        const startY = PdfGenerator._generatePdfHeader(doc, institution, 'Notificación de Flexibilidad Académica');
        
        let text = `Se notifica que la estudiante ${student.fullName} requiere la aplicación de medidas de flexibilidad académica debido a su estado de gestación. Detalles: ${item.flexibilityDetails || 'No especificados.'}. Se solicita al docente tutor ${tutor?.fullName || '(no asignado)'} y demás docentes, brindar el apoyo pedagógico necesario.`;
        let currentY = PdfGenerator._renderJustifiedText(doc, text, startY);
        currentY += 20;
        doc.text("Atentamente,", MARGINS.left, currentY);
        currentY += 20;
        PdfGenerator._generateSignatureBlock(doc, currentY, user?.nombreCompleto || '', user?.cargo || 'Profesional DECE');
        
        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Flexibilidad_${student.fullName.replace(/ /g, '_')}.pdf`);
    },
    generateAssistedClassesReportPdf: async (reportData: { studentName: string; studentCourse: string; studentParallel: string; tutorName: string; reason: string; tentativeReturnDate: string }[], filterText: string) => {
        const title = "Reporte de Clases Asistidas";
        const columns = ["Estudiante", "Curso", "Tutor", "Motivo", "Fecha Retorno"];
        const body = reportData.map(item => [
            item.studentName,
            `${item.studentCourse} "${item.studentParallel}"`,
            item.tutorName,
            item.reason,
            Utils.formatDate(item.tentativeReturnDate)
        ]);
        await PdfGenerator.generateReportPdf(title, columns, body, filterText);
    },
    generateJuntasReportPdf: async (options: { courseName: string; parallel: string; reportTitle: string; startDate: string; endDate: string }) => {
        const { courseName, parallel, reportTitle, startDate, endDate } = options;
        const institution = await db.institution.get(1);
        const user = await db.users.get(Number(sessionStorage.getItem('currentUser')));
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        
        // 1. Data Fetching
        // Use filter because courses table is small and might not have [name+parallel] index
        const course = await db.courses.filter(c => c.name === courseName && c.parallel === parallel).first();
        
        // Correct logic to find Tutor:
        const tutor = await db.teachers.where('tutorOfCourseId').equals(course?.id).first();

        const students = await db.students.where('[course+parallel]').equals([courseName, parallel]).toArray();
        const studentIds = students.map(s => s.id!);
        
        // Fetch relevant cases and followups
        const cases = await db.caseFiles.where('studentId').anyOf(studentIds).toArray();
        const caseIds = cases.map(c => c.id!);
        const followUps = await db.followUps
            .where('caseId').anyOf(caseIds)
            .and(f => f.date >= startDate && f.date <= endDate)
            .toArray();

        // 2. Data Preparation for Table
        const tableBody: any[] = [];
        
        for (const student of students) {
            const studentCases = cases.filter(c => c.studentId === student.id);
            const studentRep = await db.representatives.get(student.representativeId);
            
            // Check if student has any followups in range for any case
            const relevantCases = studentCases.filter(c => 
                followUps.some(f => f.caseId === c.id)
            );

            if (relevantCases.length > 0) {
                for (const c of relevantCases) {
                    const caseFollowUps = followUps.filter(f => f.caseId === c.id);
                    const actions = caseFollowUps.map(f => `- ${f.description} (${Utils.formatDate(f.date)})`).join('\n');
                    
                    tableBody.push([
                        `${student.fullName}\nRep: ${studentRep?.fullName || 'N/A'}`,
                        "Docente Tutor / DECE",
                        Utils.getSafeCategoryName(c.category),
                        actions,
                        c.status
                    ]);
                }
            }
        }

        if (tableBody.length === 0) {
            tableBody.push([{ content: "No se registraron atenciones en este periodo.", colSpan: 5, styles: { halign: 'center' } }]);
        }

        // 3. PDF Generation
        const doc = new jsPDF();
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bgSetting?.value);
        addBackgroundToPage();

        // --- Header Block ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("DEPARTAMENTO DE CONSEJERÍA ESTUDIANTIL", doc.internal.pageSize.getWidth() / 2, MARGINS.top, { align: 'center' });
        
        // Blue Sub-header
        autoTable(doc, {
            startY: MARGINS.top + 5,
            head: [['REPORTE PARA JUNTA DE GRADO O CURSO']],
            headStyles: { fillColor: [220, 237, 250], textColor: 0, fontStyle: 'bold', halign: 'center' },
            body: [],
            margin: { left: MARGINS.left, right: MARGINS.right },
        });

        // Info Table
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            body: [
                [{ content: 'Nombre de la institución educativa:', styles: { fontStyle: 'bold' } }, institution?.name || '', { content: 'Periodo lectivo:', styles: { fontStyle: 'bold' } }, institution?.schoolYear || ''],
                [{ content: 'Grado o curso:', styles: { fontStyle: 'bold' } }, courseName, { content: 'Paralelo:', styles: { fontStyle: 'bold' } }, parallel],
                [{ content: 'Jornada:', styles: { fontStyle: 'bold' } }, course?.jornada || '', { content: '', colSpan: 2 }],
                [{ content: 'Profesional del DECE:', styles: { fontStyle: 'bold' } }, user?.nombreCompleto || '', { content: '', colSpan: 2 }],
                [{ content: 'Coordinador/a DECE:', styles: { fontStyle: 'bold' } }, '', { content: '', colSpan: 2 }],
                [{ content: 'Docente Tutor/a:', styles: { fontStyle: 'bold' } }, tutor?.fullName || 'No asignado', { content: '', colSpan: 2 }],
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 1 },
            columnStyles: { 0: { cellWidth: 50 }, 2: { cellWidth: 30 } },
            margin: { left: MARGINS.left, right: MARGINS.right },
        });

        // Report Title (Blue)
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            head: [[`INFORME DEL ${reportTitle}`]],
            headStyles: { fillColor: [220, 237, 250], textColor: 0, fontStyle: 'bold', halign: 'center' },
            body: [],
            margin: { left: MARGINS.left, right: MARGINS.right },
        });

        // Main Table
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY,
            head: [['ESTUDIANTE', 'REMITIDO POR:', 'ASUNTO', 'ACCIONES TOMADAS', 'OBSERVACIONES']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [220, 237, 250], textColor: 0, fontStyle: 'bold', halign: 'center', valign: 'middle' },
            styles: { fontSize: 8, valign: 'middle', cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 40 }, // Estudiante
                1: { cellWidth: 25 }, // Remitido Por
                2: { cellWidth: 30 }, // Asunto
                3: { cellWidth: 40 }, // Acciones
                // Observaciones takes remaining space
            },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage
        });

        // Signatures
        let currentY = (doc as any).lastAutoTable.finalY + 30;
        if (currentY > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            addBackgroundToPage();
            currentY = MARGINS.top + 20;
        }

        // Two signatures on top row
        const width = doc.internal.pageSize.getWidth();
        
        doc.line(MARGINS.left, currentY, MARGINS.left + 60, currentY);
        doc.line(width - MARGINS.right - 60, currentY, width - MARGINS.right, currentY);
        
        doc.setFontSize(10);
        doc.text("Coordinador/a DECE", MARGINS.left + 10, currentY + 5);
        doc.text("Profesional DECE", width - MARGINS.right - 50, currentY + 5);
        
        currentY += 25;
        doc.text(`Recibido por tutor/a: _______________________________`, MARGINS.left, currentY);

        // Simple footer with date/page
        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Informe_Junta_${courseName}_${parallel}.pdf`);
    },
    generateRiesgoReportPdf: async (options: { type: 'institution' | 'course', course?: string, parallel?: string, categoryIds: number[] }) => {
        const { type, course, parallel, categoryIds } = options;
        const categories = await db.caseCategories.where('id').anyOf(categoryIds).toArray();
        const categoryNames = categories.map(c => c.name);

        let studentsQuery: Dexie.Collection<Student, number>;
        if (type === 'course' && course && parallel) {
            studentsQuery = db.students.where({ course, parallel });
        } else {
            studentsQuery = db.students.toCollection();
        }
        const students = await studentsQuery.toArray();
        const studentIds = students.map(s => s.id!);

        const cases = await db.caseFiles.where('studentId').anyOf(studentIds)
            .and(c => categoryNames.includes(c.category))
            .toArray();
            
        const studentMap = new Map<number, Student>(students.filter(s => s.id != null).map(s => [s.id!, s]));
        const body = cases.map(c => {
            const student = studentMap.get(c.studentId);
            return [student?.fullName || 'N/A', `${student?.course} "${student?.parallel}"`, Utils.getSafeCategoryName(c.category), c.priority];
        });
        
        await PdfGenerator.generateReportPdf(
            'Informe de Estudiantes en Grupos de Riesgo',
            ['Estudiante', 'Curso', 'Categoría de Riesgo', 'Prioridad'],
            body,
            `Filtro: ${type === 'course' ? `${course} "${parallel}"` : 'Institucional'}`
        );
    },
    generateGeneralReportPdf: async (startDate: string, endDate: string, attentionMatrix: any[], participantHeaders: string[], activitiesData: any[]) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();

        const institution = await db.institution.get(1);
        let startY = PdfGenerator._generatePdfHeader(doc, institution, `Informe General de Actividades DECE`);
        
        doc.setFontSize(10).text(`Período: Desde ${Utils.formatDate(startDate)} hasta ${Utils.formatDate(endDate)}`, MARGINS.left, startY);
        startY += 10;
        
        doc.setFontSize(12).setFont('helvetica', 'bold').text('Matriz de Atenciones por Categoría y Participante', MARGINS.left, startY);
        startY += 5;

        autoTable(doc, {
            startY: startY,
            head: [['Categoría', ...participantHeaders]],
            body: attentionMatrix.map(row => [row.category, ...participantHeaders.map(p => row[p] || 0)]),
            willDrawPage: addBackgroundToPage,
        });
        let lastY = (doc as any).lastAutoTable.finalY + 10;
        
        doc.setFontSize(12).setFont('helvetica', 'bold').text('Actividades Preventivas Realizadas', MARGINS.left, lastY);
        lastY += 5;
        
        autoTable(doc, {
            startY: lastY,
            head: [['Fecha', 'Tema', 'Est.', 'Padres', 'Doc.', 'Dir.', 'Total']],
            body: activitiesData.map(act => [
                Utils.formatDate(act.date), 
                act.name,
                act.estudiantes,
                act.padres,
                act.docentes,
                act.directivos,
                act.total
            ]),
            willDrawPage: addBackgroundToPage,
        });

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Informe_General_DECE_${startDate}_${endDate}.pdf`);
    },
    generateDeceFormPdf: async (caseId: number) => {
        // --- Fetch all required data ---
        const form = await db.deceFollowUpForms.where({ caseFileId: caseId }).first();
        if (!form) throw new Error("Formulario no encontrado para este caso.");

        const details = await db.sexualViolenceCaseDetails.where({ caseFileId: caseId }).first();
        if (!details) throw new Error("Detalles del caso de violencia sexual no encontrados.");

        const victims = await db.sexualViolenceVictims.where({ svCaseDetailsId: details.id! }).toArray();
        const institution = await db.institution.get(1);
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;

        // --- PDF Setup ---
        const doc = new jsPDF();
        const addBackgroundToPage = () => PdfGenerator._applyBackground(doc, bg);
        addBackgroundToPage();

        let currentY = PdfGenerator._generatePdfHeader(doc, institution, 'Formulario de Seguimiento DECE - Violencia Sexual');

        const sectionHeadStyles = {
            fillColor: [224, 224, 224], // light grey
            textColor: 0,
            fontStyle: 'bold',
            halign: 'left'
        };
        const fieldStyle = { fontStyle: 'bold', cellWidth: 50 };
        const commonTableOptions = {
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2 },
            margin: { left: MARGINS.left, right: MARGINS.right },
            willDrawPage: addBackgroundToPage,
            didDrawPage: (data: any) => { currentY = data.cursor.y; }
        };

        const addKeyValueSection = (title: string, data: (string | null | undefined)[][]) => {
            autoTable(doc, {
                ...commonTableOptions,
                startY: currentY,
                head: [[{ content: title, colSpan: 2, styles: sectionHeadStyles }]],
                body: data.map(row => row.map(cell => cell || '')), // Ensure no undefined/null
                columnStyles: { 0: fieldStyle }
            });
            currentY = (doc as any).lastAutoTable.finalY + 3;
        };

        // Section 1: Responsable
        addKeyValueSection('1. DATOS DEL RESPONSABLE DEL REPORTE', [
            ['Nombres:', details.responsibleName],
            ['Cédula:', details.responsibleCedula],
            ['Cargo:', details.responsiblePosition],
            ['Email:', details.responsibleEmail],
            ['Teléfono:', details.responsiblePhone],
        ]);

        // Section 2: Infractor
        addKeyValueSection('2. DATOS DEL PRESUNTO INFRACTOR', [
            ['Nombres:', details.infractorFullName],
            ['Cédula:', details.infractorCedula],
            ['Fecha Nacimiento:', details.infractorBirthDate ? Utils.formatDate(details.infractorBirthDate) : ''],
            ['Sexo:', details.infractorSex],
            ['Relación con Víctima:', details.infractorRelationship],
        ]);

        // Section 3: Caso
        addKeyValueSection('3. DATOS DE IDENTIFICACIÓN DEL CASO', [
            ['Fecha de Incidente:', details.incidentDate ? Utils.formatDate(details.incidentDate) : ''],
            ['Fecha de Denuncia:', details.denunciationDate ? Utils.formatDate(details.denunciationDate) : ''],
            ['Relación Denunciante:', details.denunciatorRelationship],
            ['Presunto Delito:', details.crimeType],
            ['Denuncia en Fiscalía:', details.hasFiscaliaDenunciation ? 'Sí' : 'No'],
            ['N° Denuncia Fiscalía:', details.fiscaliaDenunciationNumber],
            ['Ciudad Fiscalía:', details.fiscaliaCity],
        ]);
        
        // Section 4: Víctimas
        autoTable(doc, {
            ...commonTableOptions,
            startY: currentY,
            head: [[{ content: '4. DATOS DE LA/S VÍCTIMA/S', colSpan: 5, styles: sectionHeadStyles }]],
            body: [],
        });
        currentY = (doc as any).lastAutoTable.finalY;

        autoTable(doc, {
            ...commonTableOptions,
            startY: currentY,
            head: [['Nombre', 'Cédula', 'Edad', 'Sexo', 'Nivel Educativo']],
            body: victims.map(v => [
                v.fullName,
                v.cedula,
                `${v.ageAtIncident} años`,
                v.sex,
                v.educationLevel,
            ]),
            headStyles: { fillColor: [2, 132, 199], textColor: 255 }, // dece-blue-600
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
        
        // Section 5: Form Questions
        // Map questions to answers
        const questionsBody = DECE_FORM_QUESTIONS.map(q => {
            const answer = (form as any)[q.key];
            const answerText = answer === true ? 'SÍ' : answer === false ? 'NO' : 'N/A';
            return [q.text, answerText];
        });

        // Add additional text fields from q16-q22 to the list or a separate section?
        // Let's add them as key-value pairs at the end of the question list
        const textFields = [
            ['16. Nombre del monitor del plan:', form.q16_monitorName],
            ['17. Cargo del monitor:', form.q17_monitorPosition],
            ['18a. Nuevo AMIE (si hubo cambio):', form.q18a_newAmie],
            ['18b. Nueva Institución:', form.q18b_newInstitutionName],
            ['19. Quién acompaña psicológicamente:', form.q19_psychologicalSupportProvider],
        ];

        // Combine for PDF
        autoTable(doc, {
            ...commonTableOptions,
            startY: currentY,
            head: [[{ content: '5. SEGUIMIENTO DE ACCIONES', colSpan: 2, styles: sectionHeadStyles }]],
            body: [
                ...questionsBody,
                ...textFields.map(row => [row[0], row[1] || ''])
            ],
            columnStyles: { 0: { cellWidth: 130 } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;

        // Section 6: Observations
        autoTable(doc, {
            ...commonTableOptions,
            startY: currentY,
            head: [[{ content: 'OBSERVACIONES GENERALES', styles: sectionHeadStyles }]],
            body: [[form.observations || 'Sin observaciones.']]
        });

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Formulario_DECE_${caseId}.pdf`);
    },
    generateSexualViolenceMatrixPdf: async (cases: (CaseFile & { student?: Student, details?: SexualViolenceCaseDetails, lastFollowUpDate?: string })[]) => {
        await PdfGenerator.generateReportPdf(
            "Matriz de Casos de Violencia Sexual",
            ['CÓDIGO', 'VÍCTIMA', 'EDAD', 'INFRACTOR', 'RELACIÓN', 'DELITO', 'ESTADO'],
            cases.map(c => [
                c.code,
                c.student?.fullName || 'N/A',
                c.student ? Utils.calculateAge(c.student.birthDate).display : 'N/A',
                c.details?.infractorFullName || 'N/A',
                c.details?.infractorRelationship || 'N/A',
                c.details?.crimeType || 'N/A',
                c.status
            ]),
            "Todos los registros activos"
        );
    },
    generateInterviewPdf: async (caseFile: CaseFile, student: Student, interviewType: string, formData: any) => {
        const bgSetting = await db.settings.get('pdfBackgroundBase64');
        const bg = bgSetting?.value;
        const doc = new jsPDF();
        PdfGenerator._applyBackground(doc, bg);

        const institution = await db.institution.get(1);
        let currentY = PdfGenerator._generatePdfHeader(doc, institution, `Entrevista Psicosocial - ${interviewType}`);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Estudiante: ${student.fullName}`, MARGINS.left, currentY);
        doc.text(`Curso: ${student.course} "${student.parallel}"`, MARGINS.left, currentY + 6);
        currentY += 15;

        let questions: any = {};
        if (interviewType === 'Estudiante') questions = STUDENT_INTERVIEW_QUESTIONS;
        if (interviewType === 'Docente') questions = TEACHER_INTERVIEW_QUESTIONS;
        if (interviewType === 'Representante') questions = REPRESENTATIVE_INTERVIEW_QUESTIONS;

        for (const [section, fields] of Object.entries(questions)) {
            if (currentY > doc.internal.pageSize.getHeight() - MARGINS.bottom) {
                doc.addPage();
                PdfGenerator._applyBackground(doc, bg);
                currentY = MARGINS.top;
            }

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(220, 237, 250);
            doc.rect(MARGINS.left, currentY, doc.internal.pageSize.getWidth() - MARGINS.left - MARGINS.right, 7, 'F');
            doc.text(section, MARGINS.left + 2, currentY + 5);
            currentY += 12;

            for (const field of (fields as any)) {
                const answer = formData && formData[section] ? formData[section][field.key] : '';
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                currentY = PdfGenerator._renderJustifiedText(doc, field.label, currentY);
                currentY += 2;
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                if (answer) {
                    currentY = PdfGenerator._renderJustifiedText(doc, answer, currentY, { indent: 5 });
                } else {
                    doc.text("(Sin respuesta)", MARGINS.left + 5, currentY);
                    currentY += 5;
                }
                currentY += 5;

                if (currentY > doc.internal.pageSize.getHeight() - MARGINS.bottom) {
                    doc.addPage();
                    PdfGenerator._applyBackground(doc, bg);
                    currentY = MARGINS.top;
                }
            }
            currentY += 5;
        }

        PdfGenerator._generatePdfFooter(doc);
        doc.save(`Entrevista_${interviewType}_${student.fullName.replace(/ /g, '_')}.pdf`);
    }
};