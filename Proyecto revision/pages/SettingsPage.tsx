import React, { useState, useEffect, FC } from 'react';
import { db } from '../database';
import type { CaseCategoryItem, PefModule, User } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { PlusCircle, Edit, Trash2, Download, Upload, Save, ImageOff, FileUp, AlertTriangle } from 'lucide-react';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { Utils } from '../utils/helpers';
import Modal from '../components/shared/Modal';
import GenericFormModal from '../components/shared/GenericFormModal';
import type Dexie from 'dexie';
import bcrypt from 'bcryptjs';

const CategoryFormModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    categoryToEdit: CaseCategoryItem | null;
}> = ({ isOpen, onClose, categoryToEdit }) => {
    const [name, setName] = useState('');
    const [isProtected, setIsProtected] = useState(false);

    useEffect(() => {
        setName(categoryToEdit?.name || '');
        setIsProtected(categoryToEdit?.isProtected || false);
    }, [categoryToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('El nombre de la categoría no puede estar vacío.');
            return;
        }
        try {
            if (categoryToEdit) {
                await db.caseCategories.update(categoryToEdit.id!, { name, isProtected });
            } else {
                await db.caseCategories.add({ name, isProtected });
            }
            onClose();
        } catch (error) {
            console.error("Error saving category", error);
            alert(`Error al guardar categoría: ${error}`);
        }
    };

    const title = categoryToEdit ? 'Editar Categoría' : 'Añadir Categoría';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="categoryName" className="block text-sm font-medium">Nombre de la Categoría</label>
                    <input type="text" id="categoryName" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                 <div>
                    <label className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            checked={isProtected} 
                            onChange={e => setIsProtected(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-dece-blue-600 focus:ring-dece-blue-500"
                        />
                        <span className="text-sm">Categoría Protegida (requiere atención especial y habilita notificaciones)</span>
                    </label>
                </div>
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button type="submit" className="btn-primary">Guardar</button>
                </div>
            </form>
        </Modal>
    );
};

const SettingsPage: FC<{ currentUser: User }> = ({ currentUser }) => {
    // User Profile State
    const [userProfile, setUserProfile] = useState<Partial<User>>({});

    // General Settings State
    const [bgPreview, setBgPreview] = useState<string | null>(null);
    const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '18:00' });
    const [mspAuthority, setMspAuthority] = useState({ name: '', position: '', district: '', city: '' });
    const [autoBackupConfig, setAutoBackupConfig] = useState({ enabled: false, interval: 'weekly' });
    const [leaveSettings, setLeaveSettings] = useState({
        maternity: { value: 90, unit: 'days' },
        lactation: { value: 12, unit: 'months' }
    });
    
    // Other states...
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [resetConfirm, setResetConfirm] = useState('');
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<CaseCategoryItem | null>(null);
    const [isPefModuleModalOpen, setIsPefModuleModalOpen] = useState(false);
    const [pefModuleToEdit, setPefModuleToEdit] = useState<PefModule | null>(null);

    const liveData = useLiveQuery(async () => {
        const categories = await db.caseCategories.orderBy('name').toArray();
        const cases = await db.caseFiles.toArray();
        const categoryUsage = cases.reduce((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const categoriesData = categories.map(cat => ({ ...cat, usageCount: categoryUsage[cat.name] || 0 }));
        
        const pefModules = await db.pefModules.orderBy('startDate').toArray();

        return { categoriesData, pefModules };
    }, []);

    const categoriesData = liveData?.categoriesData;
    const pefModules = liveData?.pefModules;

    useEffect(() => {
        if (currentUser) {
            setUserProfile(currentUser);
        }
        db.settings.get('pdfBackgroundBase64').then(s => {
            if (s && typeof s.value === 'string') {
                setBgPreview(s.value);
            }
        });
        db.settings.get('workingHours').then(s => {
            if (s && s.value && typeof s.value === 'object') {
                setWorkingHours(prev => ({ ...prev, ...s.value }));
            }
        });
        db.settings.get('mspAuthority').then(s => {
            if (s && s.value && typeof s.value === 'object') {
                setMspAuthority(prev => ({ ...prev, ...s.value }));
            }
        });
        db.settings.get('autoBackupConfig').then(s => {
            if (s && s.value && typeof s.value === 'object') {
                setAutoBackupConfig(prev => ({ ...prev, ...s.value }));
            }
        });
        db.settings.get('leaveSettings').then(s => {
            if (s && s.value && typeof s.value === 'object') {
                // Deep merge for nested objects
                setLeaveSettings(prev => ({
                    maternity: { ...prev.maternity, ...(s.value.maternity || {}) },
                    lactation: { ...prev.lactation, ...(s.value.lactation || {}) },
                }));
            }
        });
    }, [currentUser]);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUserProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleMspAuthorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMspAuthority(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            await db.users.update(currentUser.id!, {
                correo: userProfile.correo,
                telefono: userProfile.telefono,
                cargo: userProfile.cargo,
                direccion: userProfile.direccion,
            });
            alert('Perfil actualizado con éxito.');
        } catch (error) {
            alert(`Error al actualizar perfil: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const { base64 } = await Utils.fileToBase64(file);
            setBgPreview(base64);
        }
    };

    const handleSaveGeneralSettings = async () => {
        setIsSaving(true);
        try {
            await db.settings.put({ key: 'workingHours', value: workingHours });
            await db.settings.put({ key: 'mspAuthority', value: mspAuthority });
            if (bgPreview) {
                await db.settings.put({ key: 'pdfBackgroundBase64', value: bgPreview });
            } else {
                await db.settings.delete('pdfBackgroundBase64');
            }
            alert('Ajustes generales guardados.');
        } catch (error) {
            alert(`Error al guardar: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveLeaveSettings = async () => {
        setIsSaving(true);
        try {
            await db.settings.put({ key: 'leaveSettings', value: leaveSettings });
            alert('Configuración de permisos guardada.');
        } catch (error) {
            alert(`Error al guardar permisos: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveBackupSettings = async () => {
        setIsSaving(true);
        try {
            await db.settings.put({ key: 'autoBackupConfig', value: autoBackupConfig });
            alert('Ajustes de respaldo guardados.');
        } catch (error) {
            alert(`Error al guardar ajustes de respaldo: ${error}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const openCategoryModal = (catToEdit: CaseCategoryItem | null) => {
        setCategoryToEdit(catToEdit);
        setIsCategoryModalOpen(true);
    };
    
    const handleToggleProtected = async (category: CaseCategoryItem) => {
        if (category.id) {
            try {
                await db.caseCategories.update(category.id, { isProtected: !category.isProtected });
            } catch (error) {
                console.error("Failed to toggle protected status:", error);
                alert("Error al cambiar el estado de protección.");
            }
        }
    };

    const handleDeleteCategory = async (category: CaseCategoryItem & { usageCount: number }) => {
        if (category.usageCount > 0) {
            alert('Esta categoría no se puede eliminar porque está en uso.');
            return;
        }
        if (window.confirm(`¿Está seguro de que desea eliminar la categoría "${category.name}"?`)) {
            await db.caseCategories.delete(category.id!);
        }
    };

    const handleDeletePefModule = async (id: number) => {
        const moduleToDelete = pefModules?.find(m => m.id === id);
        if (!moduleToDelete) return;
    
        const evaluationsCount = await db.educandoEnFamilia.where('moduleName').equals(moduleToDelete.name).count();
        if (evaluationsCount > 0) {
            alert('Este módulo no se puede eliminar porque está en uso en una o más evaluaciones.');
            return;
        }
    
        if (window.confirm(`¿Está seguro de que desea eliminar el módulo "${moduleToDelete.name}"?`)) {
            await db.pefModules.delete(id);
        }
    };

    const handleExportBackup = async () => {
        setIsImporting(true);
        const backup: { [key: string]: any[] } = {};
        for (const table of (db as Dexie).tables) {
            backup[table.name] = await table.toArray();
        }
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `dece_backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        setIsImporting(false);
    };

    const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (!window.confirm("ADVERTENCIA: Importar un respaldo reemplazará TODOS los datos actuales. ¿Desea continuar?")) return;
            setIsImporting(true);
            const file = e.target.files[0];
            const text = await file.text();
            const data = JSON.parse(text);
            await (db as Dexie).transaction('rw', (db as Dexie).tables, async () => {
                for (const table of (db as Dexie).tables) {
                    await table.clear();
                    if (data[table.name]) {
                        await table.bulkPut(data[table.name]);
                    }
                }
            });
            alert("Restauración completada. La página se recargará.");
            window.location.reload();
        }
    };

    const handleResetApp = async () => {
        if (resetConfirm !== 'ELIMINAR') {
            alert('Debe escribir ELIMINAR para confirmar.');
            return;
        }
        if (window.confirm("ACCIÓN IRREVERSIBLE: ¿Está absolutamente seguro de que desea eliminar TODOS los datos?")) {
            await (db as Dexie).delete();
            alert("Aplicación reseteada. La página se recargará.");
            window.location.reload();
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Configuración</h1>
            <div className="space-y-6">

                <Card>
                    <h2 className="text-xl font-semibold mb-4">Mi Perfil</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label>Nombre Completo</label><input type="text" value={userProfile.nombreCompleto || ''} readOnly className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-700/50" /></div>
                        <div><label>Cédula</label><input type="text" value={userProfile.cedula || ''} readOnly className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-700/50" /></div>
                        <div><label>Correo Electrónico</label><input type="email" name="correo" value={userProfile.correo || ''} onChange={handleProfileChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700" /></div>
                        <div><label>Teléfono</label><input type="tel" name="telefono" value={userProfile.telefono || ''} onChange={handleProfileChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700" /></div>
                        <div className="md:col-span-2"><label>Cargo</label><input type="text" name="cargo" value={userProfile.cargo || ''} onChange={handleProfileChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700" /></div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button onClick={handleSaveProfile} disabled={isSaving} className="btn-primary flex items-center gap-2"><Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Perfil'}</button>
                    </div>
                </Card>

                 <Card>
                    <h2 className="text-xl font-semibold mb-4">Ajustes Generales y de Documentos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold mb-2">Horario Laboral para Citas</h3>
                            <div className="flex items-center gap-4">
                                <input type="time" value={workingHours.start} onChange={(e) => setWorkingHours(p => ({...p, start: e.target.value}))} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                                <span>hasta</span>
                                <input type="time" value={workingHours.end} onChange={(e) => setWorkingHours(p => ({...p, end: e.target.value}))} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold mb-2">Fondo de Documentos PDF</h3>
                            <div className="flex items-center gap-4">
                               {bgPreview ? <img src={bgPreview} alt="Preview" className="w-16 h-20 object-cover border"/> : <div className="w-16 h-20 border flex items-center justify-center bg-gray-50 dark:bg-gray-700/50"><ImageOff className="text-gray-400"/></div>}
                               <div>
                                   <label className="cursor-pointer flex items-center gap-2 btn-secondary text-sm"><FileUp size={16}/><input type="file" className="hidden" accept="image/*" onChange={handleFileChange}/><span>Cambiar</span></label>
                                   {bgPreview && <button onClick={() => setBgPreview(null)} className="text-xs text-red-500 hover:underline mt-1">Quitar</button>}
                               </div>
                            </div>
                        </div>
                         <div className="md:col-span-2">
                            <h3 className="font-semibold mb-2">Configuración de Derivaciones al MSP</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium">Nombre de Autoridad</label>
                                    <input type="text" name="name" value={mspAuthority.name} onChange={handleMspAuthorityChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Ej: Mgtr. Francisco Barrezueta" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Cargo</label>
                                    <input type="text" name="position" value={mspAuthority.position} onChange={handleMspAuthorityChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Ej: Director Distrital" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Distrito</label>
                                    <input type="text" name="district" value={mspAuthority.district} onChange={handleMspAuthorityChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Ej: 09D24 DURAN" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Ciudad</label>
                                    <input type="text" name="city" value={mspAuthority.city} onChange={handleMspAuthorityChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Ej: Durán" />
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="flex justify-end mt-6">
                        <button onClick={handleSaveGeneralSettings} disabled={isSaving} className="btn-primary flex items-center gap-2"><Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Ajustes'}</button>
                    </div>
                 </Card>

                 <Card>
                    <h2 className="text-xl font-semibold mb-4">Configuración de Permisos por Maternidad/Lactancia</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Permiso de Maternidad</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input type="number" value={leaveSettings.maternity.value} onChange={e => setLeaveSettings(p => ({ ...p, maternity: { ...p.maternity, value: Number(e.target.value) } }))} className="w-24 p-2 border rounded dark:bg-gray-700" />
                                <select value={leaveSettings.maternity.unit} onChange={e => setLeaveSettings(p => ({ ...p, maternity: { ...p.maternity, unit: e.target.value as any } }))} className="flex-1 p-2 border rounded dark:bg-gray-700">
                                    <option value="days">días</option>
                                    <option value="weeks">semanas</option>
                                    <option value="months">meses</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Permiso de Lactancia</label>
                            <div className="flex items-center gap-2 mt-1">
                                <input type="number" value={leaveSettings.lactation.value} onChange={e => setLeaveSettings(p => ({ ...p, lactation: { ...p.lactation, value: Number(e.target.value) } }))} className="w-24 p-2 border rounded dark:bg-gray-700" />
                                <select value={leaveSettings.lactation.unit} onChange={e => setLeaveSettings(p => ({ ...p, lactation: { ...p.lactation, unit: e.target.value as any } }))} className="flex-1 p-2 border rounded dark:bg-gray-700">
                                    <option value="months">meses</option>
                                    <option value="years">años</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button onClick={handleSaveLeaveSettings} disabled={isSaving} className="btn-primary flex items-center gap-2"><Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Permisos'}</button>
                    </div>
                </Card>

                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Configuración de Módulos 'Educando en Familia'</h2>
                        <button onClick={() => { setPefModuleToEdit(null); setIsPefModuleModalOpen(true); }} className="btn-primary flex items-center gap-2 text-sm">
                            <PlusCircle size={18} /> Nuevo Módulo
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                                <tr>
                                    <th className="p-2 text-left">Nombre del Módulo</th>
                                    <th className="p-2 text-left">Fecha de Inicio</th>
                                    <th className="p-2 text-left">Fecha de Fin</th>
                                    <th className="p-2 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!pefModules ? <tr><td colSpan={4}><LoadingSpinner/></td></tr> : pefModules.map(mod => (
                                    <tr key={mod.id} className="border-b dark:border-gray-700">
                                        <td className="p-2">{mod.name}</td>
                                        <td className="p-2">{Utils.formatDate(mod.startDate)}</td>
                                        <td className="p-2">{Utils.formatDate(mod.endDate)}</td>
                                        <td className="p-2 text-right">
                                            <button onClick={() => { setPefModuleToEdit(mod); setIsPefModuleModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700" title="Editar"><Edit size={16}/></button>
                                            <button onClick={() => handleDeletePefModule(mod.id!)} className="p-1 text-red-500 hover:text-red-700" title="Eliminar"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                 <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Gestión de Categorías de Casos</h2>
                        <button onClick={() => openCategoryModal(null)} className="btn-primary flex items-center gap-2 text-sm"><PlusCircle size={18} /> Nueva Categoría</button>
                    </div>
                    <div className="overflow-x-auto">
                       <table className="w-full text-sm">
                           <thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-2 text-left">Nombre</th><th className="p-2 text-center">Casos en Uso</th><th className="p-2 text-center">Protegida</th><th className="p-2 text-right">Acciones</th></tr></thead>
                           <tbody>
                               {!categoriesData ? <tr><td colSpan={4}><LoadingSpinner/></td></tr> : categoriesData.map(cat => (
                                   <tr key={cat.id} className="border-b dark:border-gray-700">
                                       <td className="p-2">{cat.name}</td>
                                       <td className="p-2 text-center">{cat.usageCount}</td>
                                       <td className="p-2 text-center">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={!!cat.isProtected} onChange={() => handleToggleProtected(cat)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dece-blue-600"></div>
                                            </label>
                                       </td>
                                       <td className="p-2 text-right">
                                           <button onClick={() => openCategoryModal(cat)} className="p-1 text-yellow-500 hover:text-yellow-700" title="Editar"><Edit size={16}/></button>
                                           <button onClick={() => handleDeleteCategory(cat)} disabled={cat.usageCount > 0} className="p-1 text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed" title="Eliminar"><Trash2 size={16}/></button>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-xl font-semibold mb-2">Respaldo y Restauración de Datos</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Exporte un archivo con todos sus datos como respaldo o importe un archivo para restaurar la aplicación a un estado anterior.</p>
                     <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={handleExportBackup} disabled={isImporting} className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Download size={18} /> Exportar Backup</button>
                        <label className={`cursor-pointer btn-secondary flex items-center justify-center gap-2 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <Upload size={18} />
                            <input type="file" className="hidden" accept=".json" onChange={handleImportBackup} disabled={isImporting}/>
                            <span>{isImporting ? 'Importando...' : 'Importar Backup'}</span>
                        </label>
                    </div>
                    <div className="mt-6 pt-4 border-t dark:border-gray-700">
                        <h3 className="font-semibold">Respaldo Automático</h3>
                        <div className="flex items-center gap-4 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-sm">Habilitar:</span>
                                <input type="checkbox" checked={autoBackupConfig.enabled} onChange={e => setAutoBackupConfig(p => ({ ...p, enabled: e.target.checked }))} className="sr-only peer" />
                                <div className="relative w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dece-blue-600"></div>
                            </label>
                            <select value={autoBackupConfig.interval} onChange={e => setAutoBackupConfig(p => ({ ...p, interval: e.target.value as any }))} disabled={!autoBackupConfig.enabled} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:opacity-50">
                                <option value="daily">Diariamente</option>
                                <option value="weekly">Semanalmente</option>
                                <option value="monthly">Mensualmente</option>
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">El respaldo automático se guardará localmente en el dispositivo. Esta funcionalidad es experimental.</p>
                        <div className="flex justify-end mt-2">
                            <button onClick={handleSaveBackupSettings} disabled={isSaving} className="btn-primary flex items-center gap-2"><Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Ajustes de Respaldo'}</button>
                        </div>
                    </div>
                </Card>

                 <Card className="border-red-500 border-2 bg-red-50 dark:bg-red-900/20">
                    <h2 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2"><AlertTriangle/> Zona de Peligro</h2>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-md">
                        <div className="flex-grow">
                            <h3 className="font-bold">Resetear Aplicación</h3>
                            <p className="text-xs">Esto eliminará permanentemente TODOS los datos.</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <input type="text" placeholder='Escriba ELIMINAR' value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 border-red-300"/>
                             <button onClick={handleResetApp} disabled={resetConfirm !== 'ELIMINAR'} className="btn-danger">Resetear Ahora</button>
                        </div>
                    </div>
                </Card>
            </div>
             {isCategoryModalOpen && <CategoryFormModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} categoryToEdit={categoryToEdit} />}
             {isPefModuleModalOpen && <GenericFormModal
                isOpen={isPefModuleModalOpen}
                onClose={() => setIsPefModuleModalOpen(false)}
                onSave={() => {}}
                itemToEdit={pefModuleToEdit}
                dbTable={db.pefModules}
                title="Módulo de PeF"
                fields={[
                    { name: 'name', label: 'Nombre del Módulo', type: 'text', required: true },
                    { name: 'startDate', label: 'Fecha de Inicio', type: 'date', required: true },
                    { name: 'endDate', label: 'Fecha de Fin', type: 'date', required: true },
                ]}
            />}
        </div>
    );
};

export default SettingsPage;