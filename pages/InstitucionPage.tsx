import React, { useState, useEffect, FC } from 'react';
import { db } from '../database';
import type { Institution } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { Building, Save } from 'lucide-react';
import Card from '../components/shared/Card';
import { Utils } from '../utils/helpers';

const InstitucionPage: FC = () => {
    const institution = useLiveQuery(() => db.institution.get(1));
    const [formData, setFormData] = useState<Partial<Institution>>({});
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    useEffect(() => {
        if (institution) {
            setFormData(institution);
            setLogoPreview(institution.logoBase64 || null);
        }
    }, [institution]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const { base64 } = await Utils.fileToBase64(file);
            setFormData(prev => ({ ...prev, logoBase64: base64 }));
            setLogoPreview(base64);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await db.institution.put({ ...formData, id: 1 } as Institution);
            alert('Datos de la institución guardados con éxito.');
        } catch (error) {
            console.error("Error saving institution data:", error);
            alert(`Error al guardar: ${error}`);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Datos de la Institución</h1>
            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 flex flex-col items-center">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Escudo Institucional</label>
                            {logoPreview ? (<img src={logoPreview} alt="Logo" className="w-40 h-40 object-contain mb-2 border rounded-md p-1" />) : (<div className="w-40 h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-2 border rounded-md"><Building size={64} className="text-gray-400" /></div>)}
                            <label className="cursor-pointer bg-dece-blue-100 dark:bg-dece-blue-900 text-dece-blue-700 dark:text-dece-blue-200 px-3 py-1 rounded-md text-sm hover:bg-dece-blue-200 dark:hover:bg-dece-blue-800"><input type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleFileChange} /><span>Subir Imagen</span></label>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2"><label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Institución</label><input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                             <div><label htmlFor="amie" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Código AMIE</label><input type="text" name="amie" id="amie" value={formData.amie || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                             <div><label htmlFor="schoolYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Periodo Lectivo</label><input type="text" name="schoolYear" id="schoolYear" placeholder="Ej: 2024-2025" value={formData.schoolYear || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                             <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                                <div><label htmlFor="coordinacionZonal" className="block text-sm font-medium">Coordinación Zonal</label><input type="text" name="coordinacionZonal" id="coordinacionZonal" placeholder="Ej: ZONA 8" value={formData.coordinacionZonal || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                                <div><label htmlFor="district" className="block text-sm font-medium">Distrito</label><input type="text" name="district" id="district" placeholder="Ej: 09D24" value={formData.district || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                             </div>
                             <div className="sm:col-span-2 grid grid-cols-3 gap-4">
                                <div><label htmlFor="provincia" className="block text-sm font-medium">Provincia</label><input type="text" name="provincia" id="provincia" placeholder="Ej: GUAYAS" value={formData.provincia || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                                <div><label htmlFor="canton" className="block text-sm font-medium">Cantón</label><input type="text" name="canton" id="canton" placeholder="Ej: DURÁN" value={formData.canton || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                                <div><label htmlFor="parroquia" className="block text-sm font-medium">Parroquia</label><input type="text" name="parroquia" id="parroquia" placeholder="Ej: ELOY ALFARO" value={formData.parroquia || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                             </div>
                            <div className="sm:col-span-2"><label htmlFor="authority" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Autoridad</label><input type="text" name="authority" id="authority" value={formData.authority || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                             <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label><input type="tel" name="phone" id="phone" value={formData.phone || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                             <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Correo Electrónico</label><input type="email" name="email" id="email" value={formData.email || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                            <div className="sm:col-span-2"><label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dirección</label><input type="text" name="address" id="address" value={formData.address || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                        </div>
                    </div>
                    <div className="flex justify-end mt-6"><button type="submit" className="flex items-center gap-2 bg-dece-blue-600 text-white px-6 py-2 rounded-md hover:bg-dece-blue-700 font-semibold"><Save size={18} /> Guardar Cambios</button></div>
                </form>
            </Card>
        </div>
    );
};

export default InstitucionPage;