import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createDocument } from '../../store/slices/dataSlice';
import { BancadaBrowser } from './BancadaBrowser';

export function BancadaPage({ profileId, search = '' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  function handleOpenDoc(doc) {
    navigate(`/bancada/editor?doc=${doc.id}`);
  }

  async function handleCreateDoc(folderId, meta = {}) {
    const id = await dispatch(createDocument({
      profileId,
      data: {
        folderId: folderId ?? null,
        title: meta.title?.trim() || 'Novo documento',
        type: meta.type ?? 'note',
        template: meta.template ?? 'free',
        sourceTemplateId: meta.sourceTemplateId ?? null,
        sourceTemplateName: meta.sourceTemplateName ?? null,
        status: 'draft',
        content: '',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })).unwrap();

    navigate(`/bancada/editor?doc=${id}`);
  }

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg0)', margin: '0 -24px' }}>
      <BancadaBrowser
        profileId={profileId}
        onOpenDoc={handleOpenDoc}
        onCreateDoc={handleCreateDoc}
        search={search}
      />
    </div>
  );
}
