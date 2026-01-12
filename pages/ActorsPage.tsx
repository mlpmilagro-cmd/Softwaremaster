
import React, { useState, useMemo, FC, ReactNode } from 'react';
import { db, User } from '../database';
import type { Student, Teacher, Representative, Course } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { User as UserIcon, Briefcase, Users, BookOpen, Search, Printer, PlusCircle, Eye, Edit, Trash2, FileBarChart2, MessageSquare } from 'lucide-react';
import Card from '../components/shared/Card';
import StudentFormModal from '../components/shared/StudentFormModal';
import StudentProfileModal from '../components/shared/StudentProfileModal';
import RepresentativeProfileModal from '../components/shared/RepresentativeProfileModal';
import GenericFormModal from '../components/shared/GenericFormModal';
import JuntasReportModal from '../components/reports/JuntasReportModal';
import RiesgoReportModal from '../components/reports/RiesgoReportModal';
import { PdfGenerator } from '../utils/pdf';
import { ExcelGenerator } from '../utils/excel';
import { Utils } from '../utils/helpers';
import AttentionModal from '../components/shared/AttentionModal';

const ActorsPage: FC<{currentUser: User}> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState('students');
    const [searchTerm, setSearchTerm] = useState('');
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isExcelLoading, setIsExcelLoading] = useState(false);

    // Modals state
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileStudentId, setProfileStudentId] = useState<number | null>(null);

    const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
    const [teacherToEdit, setTeacherToEdit] = useState<Teacher | null>(null);

    const [isRepModalOpen, setIsRepModalOpen] = useState(false);
    const [repToEdit, setRepToEdit] = useState<Representative | null>(null);
    const [isRepProfileModalOpen, setIsRepProfileModalOpen] = useState(false);
    const [repProfileId, setRepProfileId] = useState<number | null>(null);
    
    const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
    const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);

    const [isJuntasModalOpen, setIsJuntasModalOpen] = useState(false);
    const [isRiesgoModalOpen, setIsRiesgoModalOpen] = useState(false);

    const [isAttentionModalOpen, setIsAttentionModalOpen] = useState(false);
    const [selectedRepIdForAttention, setSelectedRepIdForAttention] = useState<number | null>(null);


    const data = useLiveQuery(async () => {
        const [students, teachers, representatives, courses, categories] = await Promise.all([
            db.students.orderBy('fullName').toArray(),
            db.teachers.orderBy('fullName').toArray(),
            db.representatives.orderBy('fullName').toArray(),
            db.courses.orderBy('name').toArray(),
            db.caseCategories.orderBy('name').toArray(),
        ]);
        return { students, teachers, representatives, courses, categories };
    }, []);

    const { students, teachers, representatives, courses, categories } = data || {};
    
    const studentsByRep = useMemo(() => {
        if (!students) return new Map<number, number>();
        return students.reduce((acc, student) => {
            acc.set(student.representativeId, (acc.get(student.representativeId) || 0) + 1);
            return acc;
        }, new Map<number, number>());
    }, [students]);
    
    const courseMap = useMemo(() => {
        if (!courses) return new Map<number, string>();
        return new Map(courses.map(c => [c.id!, `${c.name} "${c.parallel}"`]));
    }, [courses]);

    const filteredData = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase();
        if (!lowerSearch) return { students, teachers, representatives, courses };
        return {
            students: students?.filter(s => s.fullName.toLowerCase().includes(lowerSearch) || String(s.cedula).includes(lowerSearch)),
            teachers: teachers?.filter(t => t.fullName.toLowerCase().includes(lowerSearch) || String(t.cedula).includes(lowerSearch)),
            representatives: representatives?.filter(r => r.fullName.toLowerCase().includes(lowerSearch) || String(r.cedula).includes(lowerSearch)),
            courses: courses?.filter(c => c.name.toLowerCase().includes(lowerSearch) || c.parallel.toLowerCase().includes(lowerSearch)),
        };
    }, [searchTerm, students, teachers, representatives, courses]);
    
    const handleDeleteStudent = async (id: number, name: string) => {
        const caseCount = await db.caseFiles.where('studentId').equals(id).count();
        if (caseCount > 0) {
            alert(`No se puede eliminar a "${name}" porque está asociado a ${caseCount} expediente(s) de caso. Primero debe eliminar los expedientes asociados.`);
            return;
        }

        if (window.confirm(`¿Está seguro de que desea eliminar a ${name}? Esta acción no se puede deshacer.`)) {
            try {
                await db.students.delete(id);
            } catch (error) {
                alert(`Error al eliminar: ${error}`);
            }
        }
    };

    const handleDeleteTeacher = async (teacher: Teacher) => {
        if (teacher.isTutor && teacher.tutorOfCourseId) {
            const course = await db.courses.get(teacher.tutorOfCourseId);
            alert(`No se puede eliminar a "${teacher.fullName}" porque es tutor/a del curso ${course?.name} "${course?.parallel}". Primero debe reasignar la tutoría de este curso.`);
            return;
        }
        
        const studentCount = await db.students.where('tutorId').equals(teacher.id!).count();
        if (studentCount > 0) {
            alert(`No se puede eliminar a "${teacher.fullName}" porque está asignado como tutor a ${studentCount} estudiante(s). Primero debe reasignar los tutores de esos estudiantes.`);
            return;
        }

        if (window.confirm(`¿Está seguro de que desea eliminar a ${teacher.fullName}? Esta acción no se puede deshacer.`)) {
            try {
                await db.teachers.delete(teacher.id!);
            } catch (error) {
                alert(`Error al eliminar: ${error}`);
            }
        }
    };

    const handleDeleteRepresentative = async (id: number, name: string) => {
        const studentCount = await db.students.where('representativeId').equals(id).count();
        if (studentCount > 0) {
            alert(`No se puede eliminar a "${name}" porque tiene ${studentCount} estudiante(s) a su cargo. Primero debe reasignar o eliminar los estudiantes asociados.`);
            return;
        }

        if (window.confirm(`¿Está seguro de que desea eliminar a ${name}? Esta acción no se puede deshacer.`)) {
            try {
                await db.representatives.delete(id);
            } catch (error) {
                alert(`Error al eliminar: ${error}`);
            }
        }
    };
    
    const handleDeleteCourse = async (course: Course) => {
        const studentCount = await db.students.where('[course+parallel]').equals([course.name, course.parallel]).count();
        if (studentCount > 0) {
            alert(`No se puede eliminar el curso ${course.name} "${course.parallel}" porque tiene ${studentCount} estudiante(s) asignado(s).`);
            return;
        }
        
        const teacherCount = await db.teachers.where('tutorOfCourseId').equals(course.id!).count();
        if (teacherCount > 0) {
            alert(`No se puede eliminar el curso ${course.name} "${course.parallel}" porque tiene un docente asignado como tutor. Primero reasigne la tutoría.`);
            return;
        }

        if (window.confirm(`¿Está seguro de que desea eliminar el curso ${course.name} "${course.parallel}"? Esta acción no se puede deshacer.`)) {
            try {
                await db.courses.delete(course.id!);
            } catch (error) {
                alert(`Error al eliminar: ${error}`);
            }
        }
    };

    const handlePrint = async () => {
        setIsPdfLoading(true);
        try {
            let title = "", columns: string[] = [], body: any[][] = [];
            let data: any[] = [];
            
            switch(activeTab) {
                case 'students':
                    title = "Listado de Estudiantes";
                    columns = ["Nombre Completo", "Cédula", "Curso", "Paralelo", "Representante"];
                    const repMap = new Map(representatives?.map(r => [r.id, r.fullName]));
                    data = filteredData.students || [];
                    body = data.map((s: any) => [s.fullName, s.cedula, s.course, s.parallel, repMap.get(s.representativeId) || 'N/A']);
                    break;
                case 'teachers':
                    title = "Listado de Docentes";
                    columns = ["Nombre Completo", "Cédula", "Email", "Teléfono", "Tutor de"];
                    data = filteredData.teachers || [];
                    body = data.map((t: any) => [t.fullName, t.cedula, t.email, t.phone, t.isTutor && t.tutorOfCourseId ? courseMap.get(t.tutorOfCourseId) : 'No']);
                    break;
                case 'representatives':
                    title = "Listado de Representantes";
                    columns = ["Nombre Completo", "Cédula", "Teléfono", "Nº Estudiantes"];
                    data = filteredData.representatives || [];
                    body = data.map((r: any) => [r.fullName, r.cedula, r.phone, studentsByRep.get(r.id!) || 0]);
                    break;
                case 'courses':
                     title = "Listado de Cursos";
                    columns = ["Curso", "Paralelo", "Jornada"];
                    data = filteredData.courses || [];
                    body = data.map((c: any) => [c.name, c.parallel, c.jornada]);
                    break;
            }
            await PdfGenerator.generateReportPdf(title, columns, body, searchTerm || "Ninguno");
        } catch (error) {
            console.error("PDF Export failed:", error);
            alert(`No se pudo generar el PDF: ${error}`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    const handleExportExcel = async () => {
        setIsExcelLoading(true);
        try {
            switch(activeTab) {
                case 'students':
                    const studentsData = filteredData.students || [];
                    const repMap = new Map(representatives?.filter(r=>r.id).map(r => [r.id!, r.fullName]));
                    const dataForExcel = studentsData.map(s => ({
                        ...s,
                        representativeName: repMap.get(s.representativeId) || 'N/A'
                    }));
                    await ExcelGenerator.exportActorsList(dataForExcel, 'Estudiantes');
                    break;
                case 'teachers':
                    const teachersData = filteredData.teachers || [];
                     const dataForExcelT = teachersData.map(t => ({
                        ...t,
                        tutorOfCourseName: t.isTutor && t.tutorOfCourseId ? courseMap.get(t.tutorOfCourseId) : 'No'
                    }));
                    await ExcelGenerator.exportActorsList(dataForExcelT, 'Docentes');
                    break;
                case 'representatives':
                    const repsData = filteredData.representatives || [];
                    const dataForExcelR = repsData.map(r => ({
                        ...r,
                        studentCount: studentsByRep.get(r.id!) || 0
                    }));
                    await ExcelGenerator.exportActorsList(dataForExcelR, 'Representantes');
                    break;
                case 'courses':
                    await ExcelGenerator.exportActorsList(filteredData.courses || [], 'Cursos');
                    break;
            }
        } catch (error) {
            console.error("Excel Export failed:", error);
            alert(`No se pudo generar el Excel: ${error}`);
        } finally {
            setIsExcelLoading(false);
        }
    };
    
    const renderContent = (): ReactNode => {
        switch(activeTab) {
            case 'students':
                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                           <thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-3 text-left">Nombre</th><th className="p-3 text-left">Cédula</th><th className="p-3 text-left">Curso</th><th className="p-3 text-left hidden sm:table-cell">Edad</th><th className="p-3 text-right">Acciones</th></tr></thead>
                           <tbody>{filteredData.students?.filter(s => s.id != null).map((s: Student) => (
                               <tr key={s.id!} className="border-b dark:border-gray-700">
                                   <td className="p-3">
                                        <div className="flex items-center">
                                            {s.photoBase64 ? (
                                                <img src={s.photoBase64} alt={s.fullName} className="w-8 h-8 rounded-full object-cover mr-3" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-3 flex-shrink-0">
                                                    <UserIcon size={18} className="text-gray-400" />
                                                </div>
                                            )}
                                            <span>{s.fullName}</span>
                                        </div>
                                   </td>
                                   <td className="p-3">{s.cedula}</td><td className="p-3">{`${s.course} "${s.parallel}"`}</td><td className="p-3 hidden sm:table-cell">{Utils.calculateAge(s.birthDate).display}</td>
                                   <td className="p-3 text-right">
                                       <button onClick={() => { setProfileStudentId(s.id!); setIsProfileModalOpen(true); }} className="p-1 text-blue-500 hover:text-blue-700"><Eye size={18} /></button>
                                       <button onClick={() => { setStudentToEdit(s); setIsStudentModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700"><Edit size={18} /></button>
                                       <button onClick={() => handleDeleteStudent(s.id!, s.fullName)} className="p-1 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                   </td>
                               </tr>
                           ))}</tbody>
                        </table>
                    </div>
                );
            case 'teachers':
                 return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                           <thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-3 text-left">Nombre</th><th className="p-3 text-left">Cédula</th><th className="p-3 text-left hidden sm:table-cell">Email</th><th className="p-3 text-left">Tutor de</th><th className="p-3 text-right">Acciones</th></tr></thead>
                           <tbody>{filteredData.teachers?.filter(t => t.id != null).map((t: Teacher) => (
                               <tr key={t.id!} className="border-b dark:border-gray-700">
                                   <td className="p-3">{t.fullName}</td><td className="p-3">{t.cedula}</td><td className="p-3 hidden sm:table-cell">{t.email}</td><td className="p-3">{t.isTutor && t.tutorOfCourseId ? courseMap.get(t.tutorOfCourseId) : 'No es tutor'}</td>
                                   <td className="p-3 text-right">
                                       <button onClick={() => { setTeacherToEdit(t); setIsTeacherModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700"><Edit size={18} /></button>
                                       <button onClick={() => handleDeleteTeacher(t)} className="p-1 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                   </td>
                               </tr>
                           ))}</tbody>
                        </table>
                    </div>
                );
            case 'representatives':
                 return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                           <thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-3 text-left">Nombre</th><th className="p-3 text-left">Cédula</th><th className="p-3 text-left hidden sm:table-cell">Teléfono</th><th className="p-3 text-left">Nº Estudiantes</th><th className="p-3 text-right">Acciones</th></tr></thead>
                           <tbody>{filteredData.representatives?.filter(r => r.id != null).map((r: Representative) => (
                               <tr key={r.id!} className="border-b dark:border-gray-700">
                                   <td className="p-3 font-medium cursor-pointer hover:underline" onClick={() => { setRepProfileId(r.id!); setIsRepProfileModalOpen(true); }}>{r.fullName}</td>
                                   <td className="p-3">{r.cedula}</td>
                                   <td className="p-3 hidden sm:table-cell">{r.phone}</td>
                                   <td className="p-3 text-center">{studentsByRep.get(r.id!) || 0}</td>
                                   <td className="p-3 text-right">
                                       <button onClick={() => { setSelectedRepIdForAttention(r.id!); setIsAttentionModalOpen(true); }} className="p-1 text-blue-500 hover:text-blue-700" title="Registrar Atención"><MessageSquare size={18}/></button>
                                       <button onClick={() => { setRepToEdit(r); setIsRepModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700"><Edit size={18} /></button>
                                       <button onClick={() => handleDeleteRepresentative(r.id!, r.fullName)} className="p-1 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                   </td>
                               </tr>
                           ))}</tbody>
                        </table>
                    </div>
                );
            case 'courses':
                 return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                           <thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-3 text-left">Curso</th><th className="p-3 text-left">Paralelo</th><th className="p-3 text-left">Jornada</th><th className="p-3 text-right">Acciones</th></tr></thead>
                           <tbody>{filteredData.courses?.filter(c => c.id != null).map((c: Course) => (
                               <tr key={c.id!} className="border-b dark:border-gray-700">
                                   <td className="p-3">{c.name}</td><td className="p-3">{c.parallel}</td><td className="p-3">{c.jornada}</td>
                                   <td className="p-3 text-right">
                                       <button onClick={() => { setCourseToEdit(c); setIsCourseModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700"><Edit size={18} /></button>
                                       <button onClick={() => handleDeleteCourse(c)} className="p-1 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                   </td>
                               </tr>
                           ))}</tbody>
                        </table>
                    </div>
                );
            default: return null;
        }
    };
    
    const openAddModal = () => {
        switch(activeTab) {
            case 'students': setStudentToEdit(null); setIsStudentModalOpen(true); break;
            case 'teachers': setTeacherToEdit(null); setIsTeacherModalOpen(true); break;
            case 'representatives': setRepToEdit(null); setIsRepModalOpen(true); break;
            case 'courses': setCourseToEdit(null); setIsCourseModalOpen(true); break;
        }
    };

    const tabConfig = {
        students: { title: 'Estudiantes', Icon: UserIcon },
        teachers: { title: 'Docentes', Icon: Briefcase },
        representatives: { title: 'Representantes', Icon: Users },
        courses: { title: 'Cursos', Icon: BookOpen },
    };

    const teacherFormFields = [
        { name: 'fullName', label: 'Nombre Completo', type: 'text', required: true },
        { name: 'cedula', label: 'Cédula', type: 'text', required: true, validation: { regex: '^\\d{10}$', errorMessage: 'La cédula debe tener 10 dígitos.' } },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Teléfono', type: 'tel', validation: { regex: '^09\\d{8}$', errorMessage: 'El teléfono debe tener 10 dígitos y empezar con 09.' } },
        { name: 'isTutor', label: 'Es Tutor', type: 'checkbox' },
        { name: 'tutorOfCourseId', label: 'Curso Asignado (si es tutor)', type: 'select', 
          options: courses?.map(c => ({ value: String(c.id!), label: `${c.name} "${c.parallel}" (${c.jornada})` })) || [],
          dependsOn: 'isTutor',
        },
    ];

    const representativeFormFields = [
        { name: 'fullName', label: 'Nombre Completo', type: 'text', required: true },
        { name: 'cedula', label: 'Cédula', type: 'text', required: true, validation: { regex: '^\\d{10}$', errorMessage: 'La cédula debe tener 10 dígitos.' } },
        { name: 'age', label: 'Edad', type: 'number' },
        { name: 'phone', label: 'Teléfono', type: 'tel', validation: { regex: '^09\\d{8}$', errorMessage: 'El teléfono debe tener 10 dígitos y empezar con 09.' } },
        { name: 'address', label: 'Dirección', type: 'text' }
    ];

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Gestión de Actores</h1>
            
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {Object.entries(tabConfig).map(([key, {title, Icon}]) => (
                         <button key={key} onClick={() => setActiveTab(key)}
                             className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === key ? 'border-dece-blue-500 text-dece-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                             <Icon size={18}/> {title}
                         </button>
                    ))}
                </nav>
            </div>
            
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <div className="relative w-full sm:w-72">
                        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => setIsJuntasModalOpen(true)} className="btn-secondary text-sm px-3 py-1.5"><FileBarChart2 size={16} className="mr-1"/> Informe Juntas</button>
                        <button onClick={() => setIsRiesgoModalOpen(true)} className="btn-secondary text-sm px-3 py-1.5"><FileBarChart2 size={16} className="mr-1"/> Informe Riesgos</button>
                        <button onClick={handleExportExcel} disabled={isExcelLoading} className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold disabled:bg-gray-400">
                           <FileBarChart2 size={18} /> {isExcelLoading ? '...' : ''}
                        </button>
                        <button onClick={handlePrint} disabled={isPdfLoading} className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 font-semibold disabled:bg-gray-400">
                           <Printer size={18} /> {isPdfLoading ? '...' : ''}
                        </button>
                        <button onClick={openAddModal} className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 bg-dece-blue-600 text-white px-4 py-2 rounded-md hover:bg-dece-blue-700 font-semibold">
                            <PlusCircle size={18} /> Agregar
                        </button>
                    </div>
                </div>
                {renderContent()}
            </Card>

            {isStudentModalOpen && <StudentFormModal isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} onSave={() => {}} studentToEdit={studentToEdit} />}
            {isProfileModalOpen && <StudentProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} studentId={profileStudentId} />}
            {isRepProfileModalOpen && <RepresentativeProfileModal isOpen={isRepProfileModalOpen} onClose={() => setIsRepProfileModalOpen(false)} representativeId={repProfileId} />}
            {isTeacherModalOpen && <GenericFormModal isOpen={isTeacherModalOpen} onClose={() => setIsTeacherModalOpen(false)} onSave={() => {}} itemToEdit={teacherToEdit} dbTable={db.teachers} title="Docente" fields={teacherFormFields} numberFields={['tutorOfCourseId']} />}
            {isRepModalOpen && <GenericFormModal isOpen={isRepModalOpen} onClose={() => setIsRepModalOpen(false)} onSave={() => {}} itemToEdit={repToEdit} dbTable={db.representatives} title="Representante" fields={representativeFormFields} numberFields={['age']} />}
            {isCourseModalOpen && <GenericFormModal isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} onSave={() => {}} itemToEdit={courseToEdit} dbTable={db.courses} title="Curso" fields={[ { name: 'name', label: 'Nombre del Curso', type: 'text', required: true }, { name: 'parallel', label: 'Paralelo', type: 'text', required: true }, { name: 'jornada', label: 'Jornada', type: 'select', required: true, options: [{value: 'Matutina', label: 'Matutina'}, {value: 'Vespertina', label: 'Vespertina'}, {value: 'Nocturna', label: 'Nocturna'}] } ]} />}
            {isJuntasModalOpen && <JuntasReportModal isOpen={isJuntasModalOpen} onClose={() => setIsJuntasModalOpen(false)} courses={courses || []}/>}
            {isRiesgoModalOpen && <RiesgoReportModal isOpen={isRiesgoModalOpen} onClose={() => setIsRiesgoModalOpen(false)} courses={courses || []} categories={categories || []}/>}
            {isAttentionModalOpen && <AttentionModal isOpen={isAttentionModalOpen} onClose={() => setIsAttentionModalOpen(false)} representativeId={selectedRepIdForAttention!} currentUser={currentUser} />}
        </div>
    );
};

export default ActorsPage;
