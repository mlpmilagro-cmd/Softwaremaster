
import React, { useState, useEffect, useMemo, FC } from 'react';
import { db } from '../../database';
import type { Student, Teacher, Course } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { User as UserIcon } from 'lucide-react';
import Modal from './Modal';
import { Utils } from '../../utils/helpers';

interface StudentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    studentToEdit: Student | null;
    initialData?: Partial<Student> | null;
}

const StudentFormModal: FC<StudentFormModalProps> = ({ isOpen, onClose, onSave, studentToEdit, initialData }) => {
    const [formData, setFormData] = useState<Partial<Student>>({});
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const representatives = useLiveQuery(() => db.representatives.orderBy('fullName').toArray(), []);
    const teachers = useLiveQuery(() => db.teachers.orderBy('fullName').toArray(), []);
    const courses = useLiveQuery(() => db.courses.toArray(), []) ?? [];

    const uniqueCourseNames = useMemo(() => courses ? [...new Set(courses.map((c) => c.name))].sort() : [], [courses]);
    const availableParallels = useMemo(() => {
        if (!courses || !formData.course) return [];
        return [...new Set(courses.filter((c) => c.name === formData.course).map((c) => c.parallel))].sort();
    }, [courses, formData.course]);

    useEffect(() => {
        if (studentToEdit) {
            setFormData(studentToEdit);
            setPhotoPreview(studentToEdit.photoBase64 || null);
        } else {
            setFormData({ gender: 'Masculino', ...initialData });
            setPhotoPreview(null);
        }
    }, [studentToEdit, initialData, isOpen]);
    
    // Autocomplete Tutor from Course/Parallel
    useEffect(() => {
        const findAndSetTutor = async () => {
            if (formData.course && formData.parallel && courses && teachers) {
                const course = courses.find((c: Course) => c.name === formData.course && c.parallel === formData.parallel);
                if (course) {
                    const tutor = teachers.find(t => t.isTutor && t.tutorOfCourseId === course.id);
                    if (tutor && tutor.id !== formData.tutorId) {
                        setFormData(prev => ({ ...prev, tutorId: tutor.id }));
                    }
                }
            }
        };
        findAndSetTutor();
    }, [formData.course, formData.parallel, courses, teachers]);

    // Autocomplete Course/Parallel from Tutor
    useEffect(() => {
        const findAndSetCourse = async () => {
            if (formData.tutorId && teachers && courses) {
                const tutor = teachers.find(t => t.id === formData.tutorId);
                if (tutor?.isTutor && tutor.tutorOfCourseId) {
                    const course = courses.find((c: Course) => c.id === tutor.tutorOfCourseId);
                    if (course && (course.name !== formData.course || course.parallel !== formData.parallel)) {
                        setFormData(prev => ({
                            ...prev,
                            course: course.name,
                            parallel: course.parallel
                        }));
                    }
                }
            }
        };
        findAndSetCourse();
    }, [formData.tutorId, teachers, courses]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let newFormData: Partial<Student> = { ...formData, [name]: value };

        if (name === 'course') {
            newFormData = { ...newFormData, parallel: '', tutorId: undefined };
        }
        
        if (name === 'tutorId') {
            const tutorId = Number(value);
            const tutor = teachers?.find(t => t.id === tutorId);
            if (tutor?.isTutor && tutor.tutorOfCourseId) {
                const course = courses?.find((c: Course) => c.id === tutor.tutorOfCourseId);
                if (course) {
                    newFormData = { ...newFormData, course: course.name, parallel: course.parallel };
                }
            }
        }
        
        setFormData(newFormData);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const { base64 } = await Utils.fileToBase64(file);
            const name = e.target.name;
            if (name === 'photoBase64') {
                setFormData(prev => ({ ...prev, photoBase64: base64 }));
                setPhotoPreview(base64);
            } else if (name === 'specialConditionDocBase64') {
                setFormData(prev => ({...prev, specialConditionDocBase64: base64 }));
            }
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.cedula || !formData.birthDate || !formData.representativeId || !formData.course || !formData.parallel) {
            alert('Por favor complete todos los campos obligatorios.');
            return;
        }

        const cedulaRegex = /^\d{10}$/;
        if (formData.cedula && !cedulaRegex.test(formData.cedula)) {
            alert('La cédula del estudiante debe tener 10 dígitos.');
            return;
        }

        try {
            if (studentToEdit) { await db.students.update(studentToEdit.id!, formData); } 
            else { await db.students.add(formData as Student); }
            onSave();
            onClose();
        } catch (error) {
            console.error("Error saving student data:", error);
            alert(`Error al guardar estudiante: ${error}`);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={studentToEdit ? 'Editar Estudiante' : 'Agregar Estudiante'} size="xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                        {photoPreview ? (<img src={photoPreview} alt="Foto" className="w-32 h-32 object-cover rounded-full" />) : (<div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center"><UserIcon size={64} className="text-gray-400" /></div>)}
                        <label className="cursor-pointer text-sm text-dece-blue-600 hover:underline mt-2 block text-center"><input type="file" name="photoBase64" className="hidden" accept="image/*" onChange={handleFileChange} />Subir Foto</label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-grow">
                        <div className="sm:col-span-2"><label>Nombre Completo</label><input type="text" name="fullName" value={formData.fullName || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                        <div><label>Cédula</label><input type="text" name="cedula" value={formData.cedula || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                        <div><label>Fecha de Nacimiento</label><input type="date" name="birthDate" value={formData.birthDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                        <div><label>Género</label><select name="gender" value={formData.gender || 'Masculino'} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="Otro">Otro</option></select></div>
                        <div><label>Representante</label><select name="representativeId" value={formData.representativeId || ''} onChange={(e) => setFormData(p => ({...p, representativeId: Number(e.target.value)}))} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required><option value="">Seleccione...</option>{representatives?.filter(r => r.id != null).map((r: any) => <option key={r.id!} value={r.id!}>{r.fullName}</option>)}</select></div>
                        <div><label>Curso</label><select name="course" value={formData.course || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required><option value="">Seleccione...</option>{uniqueCourseNames.map((c: string) => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div><label>Paralelo</label><select name="parallel" value={formData.parallel || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required disabled={!formData.course}><option value="">Seleccione...</option>{availableParallels.map((p: string) => <option key={p} value={p}>{p}</option>)}</select></div>
                        <div><label>Tutor</label><select name="tutorId" value={formData.tutorId || ''} onChange={(e) => setFormData(p => ({...p, tutorId: Number(e.target.value)}))} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"><option value="">Seleccione...</option>{teachers?.filter(t => t.id != null).map((t: any) => <option key={t.id!} value={t.id!}>{t.fullName}</option>)}</select></div>
                        <div className="sm:col-span-2"><label>Condición Especial (opcional)</label><input type="text" name="specialCondition" value={formData.specialCondition || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                        <div className="sm:col-span-2"><label>Documento de Condición (opcional)</label>
                            <div className="flex items-center mt-1">
                                <label className="cursor-pointer bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-l-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500"><input type="file" name="specialConditionDocBase64" className="hidden" onChange={handleFileChange} />Adjuntar</label>
                                <span className="p-2 border border-l-0 rounded-r-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm truncate w-full">{formData.specialConditionDocBase64 ? 'Archivo adjunto' : 'Ningún archivo seleccionado'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end pt-4 gap-3"><button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button><button type="submit" className="px-4 py-2 rounded bg-dece-blue-600 text-white hover:bg-dece-blue-700 font-semibold">{studentToEdit ? 'Actualizar Estudiante' : 'Guardar Estudiante'}</button></div>
            </form>
        </Modal>
    );
};

export default StudentFormModal;
