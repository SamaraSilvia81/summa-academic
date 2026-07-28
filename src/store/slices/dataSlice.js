import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  AiSuggestionRepo,
  DocumentRepo,
  FolderRepo,
  NoteRepo,
  RadarRepo,
  ReferenceRepo,
  SettingsRepo,
  TaskRepo,
} from '../../services/repositories';
import { uploadReferenceFile, deleteReferenceFile } from '../../lib/storage';

const ALL = '__all__';
const ROOT = '__root__';

export function folderKey(folderId) {
  return folderId ?? ROOT;
}

export const loadSettings = createAsyncThunk('data/loadSettings', async (profileId) => {
  if (!profileId) return null;
  return SettingsRepo.get(profileId);
});

export const saveSettings = createAsyncThunk('data/saveSettings', async ({ profileId, data }) => {
  await SettingsRepo.update(profileId, data);
  return SettingsRepo.get(profileId);
});

export const loadRadarItems = createAsyncThunk('data/loadRadarItems', async (profileId) => {
  if (!profileId) return [];
  return (await RadarRepo.getAll(profileId)) ?? [];
});

export const loadRadarStats = createAsyncThunk('data/loadRadarStats', async (profileId) => {
  if (!profileId) return null;
  return RadarRepo.getStats(profileId);
});

export const loadRadarCfps = createAsyncThunk('data/loadRadarCfps', async (profileId) => {
  if (!profileId) return [];
  return (await RadarRepo.getCfps(profileId)) ?? [];
});

export const toggleRadarSave = createAsyncThunk('data/toggleRadarSave', async ({ profileId, id }, { dispatch }) => {
  await RadarRepo.toggleSave(id);
  await dispatch(loadRadarItems(profileId));
  await dispatch(loadRadarStats(profileId));
  return id;
});

export const dismissRadarItem = createAsyncThunk('data/dismissRadarItem', async ({ profileId, id }, { dispatch }) => {
  await RadarRepo.dismiss(id);
  await dispatch(loadRadarItems(profileId));
  await dispatch(loadRadarStats(profileId));
  await dispatch(loadRadarCfps(profileId));
  return id;
});

export const markRadarItemRead = createAsyncThunk('data/markRadarItemRead', async ({ profileId, id }, { dispatch }) => {
  await RadarRepo.markRead(id);
  await dispatch(loadRadarItems(profileId));
  await dispatch(loadRadarStats(profileId));
  return id;
});

export const loadNotes = createAsyncThunk('data/loadNotes', async ({ profileId, type = null }) => {
  if (!profileId) return { key: type ?? ALL, notes: [] };
  const notes = type ? await NoteRepo.getByType(profileId, type) : await NoteRepo.getAll(profileId);
  return { key: type ?? ALL, notes: notes ?? [] };
});

export const loadReferences = createAsyncThunk('data/loadReferences', async (profileId) => {
  if (!profileId) return [];
  return (await ReferenceRepo.getAll(profileId)) ?? [];
});

export const toggleReferenceFavorite = createAsyncThunk(
  'data/toggleReferenceFavorite',
  async ({ profileId, reference }, { dispatch }) => {
    await ReferenceRepo.update(reference.id, { isFavorite: !reference.isFavorite });
    await dispatch(loadReferences(profileId));
    return reference.id;
  },
);

/** Cria uma nova referência no acervo. `file` é opcional — se vier, sobe pro storage antes de criar a linha. */
export const createReference = createAsyncThunk(
  'data/createReference',
  async ({ profileId, data, file = null }, { dispatch }) => {
    let fileMeta = {};
    if (file) {
      fileMeta = await uploadReferenceFile(profileId, file);
    }
    const id = await ReferenceRepo.create({ profileId, ...data, ...fileMeta });
    await dispatch(loadReferences(profileId));
    return id;
  },
);

/** Anexa (ou substitui) o arquivo de uma referência já existente. */
export const attachReferenceFile = createAsyncThunk(
  'data/attachReferenceFile',
  async ({ profileId, reference, file }, { dispatch }) => {
    if (reference.filePath) {
      await deleteReferenceFile(reference.filePath);
    }
    const fileMeta = await uploadReferenceFile(profileId, file);
    await ReferenceRepo.update(reference.id, fileMeta);
    await dispatch(loadReferences(profileId));
    return reference.id;
  },
);

/** Remove só o arquivo de uma referência, mantendo o registro no catálogo. */
export const removeReferenceFile = createAsyncThunk(
  'data/removeReferenceFile',
  async ({ profileId, reference }, { dispatch }) => {
    if (reference.filePath) {
      await deleteReferenceFile(reference.filePath);
    }
    await ReferenceRepo.update(reference.id, {
      filePath: null, fileName: null, fileSize: null, fileType: null, fileUploadedAt: null,
    });
    await dispatch(loadReferences(profileId));
    return reference.id;
  },
);

/** Remove o link externo de uma referência, mantendo o registro no catálogo. */
export const removeReferenceLink = createAsyncThunk(
  'data/removeReferenceLink',
  async ({ profileId, reference }, { dispatch }) => {
    await ReferenceRepo.update(reference.id, { url: null });
    await dispatch(loadReferences(profileId));
    return reference.id;
  },
);

/** Apaga a referência inteira (e o arquivo associado, se houver). */
export const deleteReference = createAsyncThunk(
  'data/deleteReference',
  async ({ profileId, reference }, { dispatch }) => {
    if (reference.filePath) {
      await deleteReferenceFile(reference.filePath);
    }
    await ReferenceRepo.delete(reference.id);
    await dispatch(loadReferences(profileId));
    return reference.id;
  },
);

/** Atualiza os metadados (título, autores, venue, ano, tipo, tags) de uma referência existente. */
export const updateReference = createAsyncThunk(
  'data/updateReference',
  async ({ profileId, reference }, { dispatch }) => {
    const { title, authors, venue, year, type, tags } = reference;
    await ReferenceRepo.update(reference.id, { title, authors, venue, year, type, tags });
    await dispatch(loadReferences(profileId));
    return reference.id;
  },
);

export const loadDocuments = createAsyncThunk('data/loadDocuments', async (profileId) => {
  if (!profileId) return [];
  return (await DocumentRepo.getAll(profileId)) ?? [];
});

export const loadDocumentsByFolder = createAsyncThunk('data/loadDocumentsByFolder', async ({ profileId, folderId = null }) => {
  if (!profileId) return { key: folderKey(folderId), documents: [] };
  const documents = await DocumentRepo.getByFolder(profileId, folderId);
  return { key: folderKey(folderId), documents: documents ?? [] };
});

export const createDocument = createAsyncThunk('data/createDocument', async ({ profileId, data }, { dispatch }) => {
  const id = await DocumentRepo.create({ profileId, ...data });
  await dispatch(loadDocuments(profileId));
  await dispatch(loadDocumentsByFolder({ profileId, folderId: data.folderId ?? null }));
  return id;
});

export const loadFolders = createAsyncThunk('data/loadFolders', async (profileId) => {
  if (!profileId) return [];
  return (await FolderRepo.getAll(profileId)) ?? [];
});

export const createFolder = createAsyncThunk('data/createFolder', async ({ profileId, name, parentId = null, extra = {} }, { dispatch }) => {
  const id = await FolderRepo.create(profileId, name, parentId, extra);
  await dispatch(loadFolders(profileId));
  return id;
});

export const renameFolder = createAsyncThunk('data/renameFolder', async ({ profileId, id, name }, { dispatch }) => {
  await FolderRepo.rename(id, name);
  await dispatch(loadFolders(profileId));
  return id;
});

export const updateFolder = createAsyncThunk('data/updateFolder', async ({ profileId, id, data }, { dispatch }) => {
  await FolderRepo.update(id, data);
  await dispatch(loadFolders(profileId));
  return id;
});

export const deleteFolder = createAsyncThunk('data/deleteFolder', async ({ profileId, id }, { dispatch }) => {
  await FolderRepo.delete(id);
  await dispatch(loadFolders(profileId));
  await dispatch(loadDocuments(profileId));
  await dispatch(loadDocumentsByFolder({ profileId, folderId: null }));
  return id;
});

export const loadTasks = createAsyncThunk('data/loadTasks', async (profileId) => {
  if (!profileId) return [];
  return (await TaskRepo.getAll(profileId)) ?? [];
});

export const loadAiSuggestions = createAsyncThunk('data/loadAiSuggestions', async (documentId) => {
  if (!documentId) return { documentId: null, suggestions: [] };
  const suggestions = await AiSuggestionRepo.getForDocument(documentId);
  return { documentId, suggestions: suggestions ?? [] };
});

const initialState = {
  settings: null,
  radar: {
    items: [],
    stats: null,
    cfps: [],
  },
  notes: {
    byKey: {},
  },
  references: [],
  documents: {
    all: [],
    byFolder: {},
  },
  folders: [],
  tasks: [],
  aiSuggestions: {
    byDocument: {},
  },
  status: {},
  errors: {},
};

function pending(state, key) {
  state.status[key] = 'loading';
  state.errors[key] = null;
}

function failed(state, key, action) {
  state.status[key] = 'failed';
  state.errors[key] = action.error.message;
}

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    resetDataState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.pending, (state) => pending(state, 'settings'))
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.settings = action.payload;
        state.status.settings = 'ready';
      })
      .addCase(loadSettings.rejected, (state, action) => failed(state, 'settings', action))
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.settings = action.payload;
        state.status.settings = 'ready';
      })
      .addCase(loadRadarItems.fulfilled, (state, action) => {
        state.radar.items = action.payload;
        state.status.radarItems = 'ready';
      })
      .addCase(loadRadarStats.fulfilled, (state, action) => {
        state.radar.stats = action.payload;
        state.status.radarStats = 'ready';
      })
      .addCase(loadRadarCfps.fulfilled, (state, action) => {
        state.radar.cfps = action.payload;
        state.status.radarCfps = 'ready';
      })
      .addCase(loadNotes.fulfilled, (state, action) => {
        state.notes.byKey[action.payload.key] = action.payload.notes;
      })
      .addCase(loadReferences.fulfilled, (state, action) => {
        state.references = action.payload;
      })
      .addCase(loadDocuments.fulfilled, (state, action) => {
        state.documents.all = action.payload;
      })
      .addCase(loadDocumentsByFolder.fulfilled, (state, action) => {
        state.documents.byFolder[action.payload.key] = action.payload.documents;
      })
      .addCase(loadFolders.fulfilled, (state, action) => {
        state.folders = action.payload;
      })
      .addCase(loadTasks.fulfilled, (state, action) => {
        state.tasks = action.payload;
      })
      .addCase(loadAiSuggestions.fulfilled, (state, action) => {
        if (action.payload.documentId) {
          state.aiSuggestions.byDocument[action.payload.documentId] = action.payload.suggestions;
        }
      });
  },
});

export const { resetDataState } = dataSlice.actions;
export const selectSettings = (state) => state.data.settings;
export default dataSlice.reducer;