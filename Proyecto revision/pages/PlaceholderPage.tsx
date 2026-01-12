
import React, { FC } from 'react';
import { Info } from 'lucide-react';
import Card from '../components/shared/Card';

const PlaceholderPage: FC<{ title: string }> = ({ title }) => (
    <div>
        <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">{title}</h1>
        <Card>
            <div className="text-center py-12">
                <Info size={48} className="mx-auto text-gray-400" />
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Funcionalidad en construcción.</p>
                <p className="text-sm text-gray-500">Esta sección estará disponible en futuras actualizaciones.</p>
            </div>
        </Card>
    </div>
);

export default PlaceholderPage;
