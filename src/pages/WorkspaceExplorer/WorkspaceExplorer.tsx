import React from 'react';
import { useWorkspaceExplorer } from './useWorkspaceExplorer';
import { VFSBrowser } from './components/VFSBrowser';
import { SpreadsheetViewer } from './components/SpreadsheetViewer';
import { Search, ArrowLeft, Sparkles, FolderOpen } from 'lucide-react';
import './WorkspaceExplorer.css';

export const WorkspaceExplorer: React.FC = () => {
  const {
    currentFolderId,
    activeFileId,
    searchQuery,
    setSearchQuery,
    navigateToFolder,
    openFile,
    closeFile,
    breadcrumbs,
    currentItems,
    allItems,
    goBack,
    activeFile,
    spreadsheetColumns,
    spreadsheetRows,
    totalCount,
    filteredCount,
    isLoading,
    createFolder,
    createExcelFile,
    moveItem,
    saveSpreadsheetChanges,
  } = useWorkspaceExplorer();

  return (
    <div className="workspace-explorer-container fade-in">
      {/* Premium Banner / Header */}
      <header className="workspace-header">
        <div className="workspace-title-section">
          <div className="workspace-icon-bg animate-pulse-subtle">
            <FolderOpen className="workspace-main-icon" size={24} />
          </div>
          <div>
            <div className="workspace-badge-row">
              <h1 className="workspace-title">Explorador de Negocios</h1>
              <span className="workspace-beta-badge">
                <Sparkles size={10} className="glow-icon" /> BETA
              </span>
            </div>
            <p className="workspace-subtitle">
              Navegá los datos reales de tu florería de forma simple y familiar, como si fueran carpetas y planillas de tu PC.
            </p>
          </div>
        </div>

        {/* Global Directory Search (Only visible when no file is open) */}
        {!activeFileId && (
          <div className="workspace-search-bar">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Buscar carpetas y planillas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="workspace-search-input"
            />
            {searchQuery && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                &times;
              </button>
            )}
          </div>
        )}
      </header>

      {/* Navigation Toolbar (Breadcrumbs & Back button) */}
      <div className="workspace-toolbar">
        <div className="breadcrumbs-wrapper">
          {currentFolderId !== 'root' || activeFileId ? (
            <button 
              onClick={goBack} 
              className="btn-back-dir"
              title="Volver atrás"
            >
              <ArrowLeft size={16} />
              <span>Atrás</span>
            </button>
          ) : null}

          <nav className="breadcrumbs" aria-label="Navegación del explorador">
            {breadcrumbs.map((bc, index) => {
              const isLast = index === breadcrumbs.length - 1 && !activeFileId;
              return (
                <React.Fragment key={bc.id}>
                  {index > 0 && <span className="breadcrumb-separator">/</span>}
                  <button
                    onClick={() => navigateToFolder(bc.id)}
                    className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                    disabled={isLast}
                  >
                    {index === 0 ? '📁 ' : ''}
                    {bc.name}
                  </button>
                </React.Fragment>
              );
            })}

            {activeFile && (
              <>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-item active filename-crumb">
                  📄 {activeFile.name}
                </span>
              </>
            )}
          </nav>
        </div>

        {!activeFileId && searchQuery && (
          <div className="search-stats">
            Encontrados: <strong>{currentItems.length}</strong> elementos
          </div>
        )}
      </div>

      {/* Dynamic Content Area */}
      <main className="workspace-main-content">
        {activeFile ? (
          <SpreadsheetViewer
            file={activeFile}
            columns={spreadsheetColumns}
            rows={spreadsheetRows}
            onClose={closeFile}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            totalCount={totalCount}
            filteredCount={filteredCount}
            isLoading={isLoading}
            onSaveChanges={saveSpreadsheetChanges}
          />
        ) : (
          <VFSBrowser
            items={currentItems}
            allItems={allItems}
            currentFolderId={currentFolderId}
            onFolderClick={navigateToFolder}
            onFileClick={openFile}
            onCreateFolder={createFolder}
            onCreateExcelFile={createExcelFile}
            onMoveItem={moveItem}
          />
        )}
      </main>
    </div>
  );
};
export default WorkspaceExplorer;
