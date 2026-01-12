import React, { useState, FC } from 'react';
import { db } from '../database';
import type { StudentRoster, Student } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StudentFormModal from '../components/shared/StudentFormModal';
import { Upload, Download } from 'lucide-react';
import { Utils } from '../utils/helpers';
import { ExcelGenerator } from '../utils/excel';
import type Dexie from 'dexie';

const StudentRosterPage: FC = () => {
    const roster = useLiveQuery(() => db.studentRoster.toArray());
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentInitialData, setStudentInitialData] = useState<Partial<Student> | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const handleCreateActor = async (rosterEntry: StudentRoster) => {
        try {
            let representative = await db.representatives.where('cedula').equals(rosterEntry.representativeCedula).first();
            if (!representative) {
                const newRepId = await db.representatives.add({
                    cedula: rosterEntry.representativeCedula,
                    fullName: rosterEntry.representativeName,
                    age: 0, address: '', phone: '' // Default values
                });
                representative = await db.representatives.get(newRepId);
            }
            if (!representative?.id) throw new Error("No se pudo crear o encontrar al representante.");

            const initialData: Partial<Student> = {
                cedula: rosterEntry.cedula,
                fullName: rosterEntry.fullName,
                course: rosterEntry.course,
                parallel: rosterEntry.parallel,
                representativeId: representative.id,
            };
            setStudentInitialData(initialData);
            setIsStudentModalOpen(true);
        } catch (error) {
            alert(`Error al preparar la creación del actor: ${error}`);
        }
    };

    const handleStudentSaved = async () => {
        if (studentInitialData?.cedula) {
            const rosterEntry = await db.studentRoster.where('cedula').equals(studentInitialData.cedula).first();
            if (rosterEntry) {
                await db.studentRoster.update(rosterEntry.id!, { status: 'Creado' });
            }
        }
        setIsStudentModalOpen(false);
        setStudentInitialData(null);
    };

    const handleDownloadTemplate = async () => {
        try {
            await ExcelGenerator.generateStudentRosterTemplate();
        } catch (error) {
            console.error("Error generating Excel template:", error);
            alert(`Ocurrió un error al generar la plantilla: ${error}`);
        }
    };

    const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (!window.confirm("Esto agregará nuevos estudiantes desde el archivo sin eliminar los existentes. ¿Desea continuar?")) {
                e.target.value = ''; // Reset file input
                return;
            }
            setIsImporting(true);
            try {
                const file = e.target.files[0];
                const data = await Utils.parseCsv(file);
                if (!data || data.length === 0) {
                    alert("El archivo CSV está vacío o tiene un formato incorrecto.");
                    return;
                }
                
                const requiredHeaders = ['cedula', 'fullName', 'course', 'parallel', 'representativeCedula', 'representativeName'];
                const fileHeaders = Object.keys(data[0]);
                const hasAllHeaders = requiredHeaders.every(h => fileHeaders.includes(h));

                if (!hasAllHeaders) {
                    alert(`El archivo CSV debe contener las columnas: ${requiredHeaders.join(', ')}`);
                    return;
                }

                const existingStudents = await db.studentRoster.toArray();
                const existingCedulas = new Set(existingStudents.map(s => s.cedula));
                
                const studentsToAdd: StudentRoster[] = [];
                let skippedCount = 0;

                data.forEach(row => {
                    if (row.cedula && !existingCedulas.has(row.cedula)) {
                        studentsToAdd.push({
                            cedula: row.cedula,
                            fullName: row.fullName,
                            course: row.course,
                            parallel: row.parallel,
                            representativeCedula: row.representativeCedula,
                            representativeName: row.representativeName,
                            status: 'Pendiente',
                        });
                        existingCedulas.add(row.cedula); // Handle duplicates within the same file
                    } else {
                        skippedCount++;
                    }
                });

                if (studentsToAdd.length > 0) {
                    await db.studentRoster.bulkAdd(studentsToAdd);
                }
                
                alert(`Importación completada. Se agregaron ${studentsToAdd.length} nuevos estudiantes. Se omitieron ${skippedCount} duplicados.`);

            } catch (error) {
                console.error("Error importing CSV:", error);
                alert(`Ocurrió un error al importar el archivo: ${error}`);
            } finally {
                setIsImporting(false);
                e.target.value = ''; // Reset file input
            }
        }
    };


    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Base de Estudiantes (Nómina)</h1>
            <Card>
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 p-2 border-b dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Importe la nómina de estudiantes para empezar a crear sus perfiles en el sistema.
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                        <button onClick={handleDownloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
                            <Download size={16} /> Descargar Plantilla
                        </button>
                        <label className={`cursor-pointer btn-primary flex items-center gap-2 text-sm ${isImporting ? 'opacity-50' : ''}`}>
                            <Upload size={16} />
                            <input type="file" className="hidden" accept=".csv" onChange={handleImportCsv} disabled={isImporting}/>
                            <span>{isImporting ? 'Importando...' : 'Importar CSV'}</span>
                        </label>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3 text-left">Nombre del Estudiante</th>
                                <th className="p-3 text-left">Cédula</th>
                                <th className="p-3 text-left">Curso</th>
                                <th className="p-3 text-left">Estado</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!roster ? (<tr><td colSpan={5}><LoadingSpinner/></td></tr>) : roster.map(item => (
                                <tr key={item.id} className="border-b dark:border-gray-700">
                                    <td className="p-3 font-medium">{item.fullName}</td>
                                    <td className="p-3">{item.cedula}</td>
                                    <td className="p-3">{`${item.course} "${item.parallel}"`}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${item.status === 'Creado' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        {item.status === 'Pendiente' && (
                                            <button onClick={() => handleCreateActor(item)} className="px-3 py-1 bg-dece-blue-600 text-white text-xs rounded hover:bg-dece-blue-700">
                                                Crear Actor
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            {isStudentModalOpen && (
                <StudentFormModal
                    isOpen={isStudentModalOpen}
                    onClose={() => { setIsStudentModalOpen(false); setStudentInitialData(null); }}
                    onSave={handleStudentSaved}
                    studentToEdit={null}
                    initialData={studentInitialData}
                />
            )}
        </div>
    );
};

export default StudentRosterPage;