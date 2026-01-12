import type { CasePriority, Appointment, PregnancyCase, CaseStatus } from '../database';

export const DateUtils = {
    addDays: (date: Date, days: number): Date => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    addMonths: (date: Date, months: number): Date => {
        const result = new Date(date);
        // Handles rolling over to the next year correctly
        result.setMonth(result.getMonth() + months);
        return result;
    },
    addYears: (date: Date, years: number): Date => {
        const result = new Date(date);
        result.setFullYear(result.getFullYear() + years);
        return result;
    },
    formatDateForInput: (date: Date): string => {
        return date.toISOString().split('T')[0];
    },
};


export const Utils = {
    calculateAge: (birthDate: string): { years: number, isAdult: boolean, display: string } => {
        if (!birthDate) return { years: 0, isAdult: false, display: 'N/A' };
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        const isAdult = age >= 18;
        return { years: age, isAdult, display: `${age} años` };
    },

    fileToBase64: (file: File): Promise<{name: string, base64: string, type: string}> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                base64: reader.result as string,
                type: file.type,
            });
            reader.onerror = error => reject(error);
        });
    },
    
    formatDate: (dateStr: string | Date, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }) => {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('es-EC', options);
    },

    getDaysUntil: (targetDate: string): number => {
        if (!targetDate) return Infinity;
        const due = new Date(targetDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const userTimezoneOffset = due.getTimezoneOffset() * 60000;
        const adjustedDue = new Date(due.getTime() + userTimezoneOffset);

        const diffTime = adjustedDue.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    getSemaforoColor: (dueDate: string) => {
        const diffDays = Utils.getDaysUntil(dueDate);
        if (diffDays === Infinity) return { bg: 'bg-gray-400', text: 'text-gray-400', label: 'Sin fecha' };
        if (diffDays < 0) return { bg: 'bg-red-500', text: 'text-red-500', label: `Vencido` };
        if (diffDays === 0) return { bg: 'bg-red-500', text: 'text-red-500', label: 'Vence Hoy' };
        if (diffDays <= 7) return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Próximo' };
        return { bg: 'bg-green-500', text: 'text-green-500', label: 'A tiempo' };
    },

    getViolenceCaseSemaforo: (dueDate: string, status: CaseStatus) => {
        if (status === 'Cerrado') {
            return { bg: 'bg-green-500', text: 'text-green-500', label: 'Cerrado' };
        }
        const diffDays = Utils.getDaysUntil(dueDate);
        if (diffDays === Infinity) return { bg: 'bg-gray-400', text: 'text-gray-400', label: 'Sin fecha' };
        if (diffDays < 0) return { bg: 'bg-red-500', text: 'text-red-500', label: `Vencido` };
        if (diffDays <= 14) return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Próximo' };
        return { bg: 'bg-green-500', text: 'text-green-500', label: 'A tiempo' };
    },
    
    getAssistedClassSemaforo: (returnDate: string) => {
        const diffDays = Utils.getDaysUntil(returnDate);
        if (diffDays === Infinity) return { bg: 'bg-gray-400', text: 'text-gray-400', label: 'Sin fecha' };
        if (diffDays < 0) return { bg: 'bg-red-500', text: 'text-red-500', label: `Retorno Vencido` };
        if (diffDays <= 3) return { bg: 'bg-red-500', text: 'text-red-500', label: 'Retorno Inminente' };
        if (diffDays <= 14) return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Próximo a Retornar' };
        return { bg: 'bg-green-500', text: 'text-green-500', label: 'A tiempo' };
    },

    getPriorityBadge: (priority: CasePriority) => {
        switch (priority) {
            case 'Baja': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'Media': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
            case 'Alta': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
            case 'Crítica': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    },
    
    getAppointmentStatusBadge: (status: Appointment['status']) => {
        switch (status) {
            case 'Programada': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            case 'Realizada': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'Cancelada': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 line-through';
            default: return 'bg-gray-100 text-gray-800';
        }
    },
    
    getPregnancyStatus(p: PregnancyCase): { text: string; color: string } {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parseDate = (dateString?: string) => {
            if (!dateString) return null;
            const date = new Date(dateString);
            const userTimezoneOffset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() + userTimezoneOffset);
        };

        const lactationEndDate = parseDate(p.lactationLeaveEndDate);
        const lactationStartDate = parseDate(p.lactationLeaveStartDate);
        const maternityStartDate = parseDate(p.maternityLeaveStartDate);
        const birthDate = parseDate(p.birthDate);
        const pregnancyStartDate = parseDate(p.pregnancyStartDate);

        if (lactationEndDate && today > lactationEndDate) {
            return { text: 'Finalizado', color: 'bg-gray-500 text-white' };
        }
        if (lactationStartDate && today >= lactationStartDate) {
            return { text: 'Permiso Lactancia', color: 'bg-purple-500 text-white' };
        }
        if (maternityStartDate && today >= maternityStartDate) {
            return { text: 'Permiso Maternidad', color: 'bg-pink-500 text-white' };
        }
        if (birthDate) {
            return { text: 'Post-parto', color: 'bg-blue-500 text-white' };
        }
        if (pregnancyStartDate) {
            const weeks = Math.floor((today.getTime() - pregnancyStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            if (weeks >= 40) {
                return { text: '40 semanas cumplidas', color: 'bg-lime-500 text-white font-bold' };
            }
            return { text: `Gestación (${weeks} sem)`, color: 'bg-teal-500 text-white' };
        }
        return { text: 'Registro Incompleto', color: 'bg-yellow-500 text-yellow-900' };
    },
    
    parseCsv: (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (!text) {
                    reject("El archivo está vacío o no se pudo leer.");
                    return;
                }
                const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    resolve([]); // No data rows
                    return;
                }
                const headers = lines[0].split(',').map(h => h.trim());
                const data = [];
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());
                    const entry: { [key: string]: string } = {};
                    for (let j = 0; j < headers.length; j++) {
                        entry[headers[j]] = values[j] || '';
                    }
                    data.push(entry);
                }
                resolve(data);
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file, 'UTF-8');
        });
    },

    exportToCsv: (filename: string, headers: string[], data: (string | number)[][]) => {
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = row.map(val => {
                const escaped = ('' + (val ?? '')).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    getSafeCategoryName: (category: string) => {
        const sensitiveKeywords = [
            'Violencia',
            'Acoso',
            'Sexual',
            'Suicidio',
            'Drogas',
            'violencia',
            'acoso',
            'sexual',
            'suicidio',
            'drogas'
        ];
        if (sensitiveKeywords.some(keyword => category.includes(keyword))) {
            return "Situación de Vulnerabilidad / Riesgo Psicosocial";
        }
        return category;
    },
};