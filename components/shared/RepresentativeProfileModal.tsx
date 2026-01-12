
import React, { useState, FC } from 'react';
import { db } from '../../database';
import type { Representative, Student } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { UserPlus } from 'lucide-react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import StudentFormModal from './StudentFormModal';

interface RepresentativeProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    representativeId: number | null;
}

const RepresentativeProfileModal: FC<RepresentativeProfileModalProps> = ({ isOpen, onClose, representativeId }) => {
    const data = useLiveQuery(async () => {
        if (!representativeId) return null;
        const representative = await db.representatives.get(representativeId);
        if (!representative) return null;
        const students = await db.students.where('representativeId').equals(representativeId).toArray();
        return { representative, students };
    }, [representativeId]);
    
    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);

    const handleAddStudent = () => {
        setIsStudentModalOpen(true);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Perfil del Representante" size="xl">
            {!data ? <LoadingSpinner /> : (
                <div className="space-y-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">{data.representative.fullName}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                            <div><p className="font-bold text-gray-500 dark:text-gray-400">Cédula</p><p>{data.representative.cedula}</p></div>
                            <div><p className="font-bold text-gray-500 dark:text-gray-400">Teléfono</p><p>{data.representative.phone || 'N/A'}</p></div>
                            <div className="col-span-2 sm:col-span-3"><p className="font-bold text-gray-500 dark:text-gray-400">Dirección</p><p>{data.representative.address || 'N/A'}</p></div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="text-lg font-semibold mb-2 border-b pb-1 dark:border-gray-600">Estudiantes a Cargo ({data.students.length})</h4>
                        {data.students.length > 0 ? (
                            <div className="overflow-x-auto max-h-60">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 dark:bg-gray-700">
                                        <tr>
                                            <th className="p-2 text-left">Nombre</th>
                                            <th className="p-2 text-left">Cédula</th>
                                            <th className="p-2 text-left">Curso</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.students.map(s => (
                                            <tr key={s.id} className="border-b dark:border-gray-700">
                                                <td className="p-2">{s.fullName}</td>
                                                <td className="p-2">{s.cedula}</td>
                                                <td className="p-2">{`${s.course} "${s.parallel}"`}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-gray-500 dark:text-gray-400 text-sm">No hay estudiantes registrados para este representante.</p>}
                    </div>

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <button onClick={handleAddStudent} className="flex items-center gap-2 bg-dece-blue-600 text-white px-4 py-2 rounded-md hover:bg-dece-blue-700 font-semibold">
                            <UserPlus size={18} /> Agregar Estudiante
                        </button>
                    </div>

                    {isStudentModalOpen && <StudentFormModal
                        isOpen={isStudentModalOpen}
                        onClose={() => setIsStudentModalOpen(false)}
                        onSave={() => setIsStudentModalOpen(false)}
                        studentToEdit={null}
                        initialData={{ representativeId: data.representative.id! }}
                    />}
                </div>
            )}
        </Modal>
    );
};

export default RepresentativeProfileModal;
