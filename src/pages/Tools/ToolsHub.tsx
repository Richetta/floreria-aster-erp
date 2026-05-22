import { useNavigate } from 'react-router-dom';
import './ToolsHub.css';

const tools = [
    {
        id: 'workspace-explorer',
        title: 'Explorador de Negocios (BETA)',
        description: 'Explorá tu inventario, ventas, clientes y proveedores visualmente mediante una intuitiva metáfora de carpetas y planillas de cálculo.',
        icon: 'folder_open',
        path: '/workspace',
        color: '#10b981',
        bg: '#ecfdf5',
    },
    {
        id: 'barcode-printer',
        title: 'Imprimir Códigos de Barra',
        description: 'Generá e imprimí etiquetas de códigos de barra de manera masiva. Elegí productos, configurá el tamaño y formato, y lanzá la impresión.',
        icon: 'barcode_scanner',
        path: '/herramientas/codigos',
        color: '#3b82f6',
        bg: '#eff6ff',
    },
    {
        id: 'marketing-copilot',
        title: 'FloriAI: Copiloto de Marketing',
        description: 'Asistente creativo y asesor inteligente conectado a tu inventario real. Generá ideas de reels, copies de WhatsApp, campañas de sobrestock y hacé crecer tu jardín digital diario.',
        icon: 'psychology_alt',
        path: '/herramientas/marketing',
        color: '#c47a5a',
        bg: '#fff1f2',
    },
    {
        id: 'coming-soon',
        title: 'Más herramientas pronto',
        description: 'Estamos trabajando en nuevas herramientas para mejorar tu operación diaria.',
        icon: 'build',
        path: '',
        color: '#94a3b8',
        bg: '#f8fafc',
        disabled: true,
    },
];

export const ToolsHub = () => {
    const navigate = useNavigate();

    const handleToolClick = (tool: typeof tools[0]) => {
        if (tool.disabled) return;
        if (tool.id === 'workspace-explorer') {
            localStorage.setItem('feature_explorer_enabled', 'true');
        }
        navigate(tool.path);
    };

    return (
        <div className="tools-hub-page">
            <div className="tools-hub-header">
                <h1>Herramientas</h1>
                <p>Utilidades para optimizar tu operación diaria</p>
            </div>

            <div className="tools-grid">
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        className={`tool-card ${tool.disabled ? 'tool-card-disabled' : ''}`}
                        onClick={() => handleToolClick(tool)}
                        disabled={tool.disabled}
                    >
                        <div className="tool-card-icon" style={{ background: tool.bg, color: tool.color }}>
                            <span className="material-symbols-rounded">{tool.icon}</span>
                        </div>
                        <div className="tool-card-content">
                            <h3>{tool.title}</h3>
                            <p>{tool.description}</p>
                        </div>
                        {!tool.disabled && (
                            <span className="material-symbols-rounded tool-card-arrow">arrow_forward</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
