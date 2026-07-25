import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectProfile } from '../store/slices/authSlice';
import {
  createFolder as createFolderThunk,
  deleteFolder as deleteFolderThunk,
  folderKey,
  loadAiSuggestions,
  loadDocuments,
  loadDocumentsByFolder,
  loadFolders,
  loadNotes,
  loadRadarCfps,
  loadRadarItems,
  loadRadarStats,
  loadReferences,
  loadSettings,
  loadTasks,
  renameFolder as renameFolderThunk,
  updateFolder as updateFolderThunk,
} from '../store/slices/dataSlice';

export function useProfile() {
  return useSelector(selectProfile);
}

export function useSettings(profileId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (profileId) dispatch(loadSettings(profileId));
  }, [dispatch, profileId]);

  return useSelector((state) => state.data.settings);
}

export function useRadarItems(profileId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (profileId) dispatch(loadRadarItems(profileId));
  }, [dispatch, profileId]);

  return useSelector((state) => state.data.radar.items);
}

export function useRadarStats(profileId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (profileId) dispatch(loadRadarStats(profileId));
  }, [dispatch, profileId]);

  return useSelector((state) => state.data.radar.stats);
}

export function useRadarCfps(profileId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (profileId) dispatch(loadRadarCfps(profileId));
  }, [dispatch, profileId]);

  return useSelector((state) => state.data.radar.cfps);
}

export function useNotes(profileId, type) {
  const dispatch = useDispatch();
  const key = type ?? '__all__';

  useEffect(() => {
    if (profileId) dispatch(loadNotes({ profileId, type }));
  }, [dispatch, profileId, type]);

  return useSelector((state) => state.data.notes.byKey[key] ?? []);
}

export function useReferences(profileId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (profileId) dispatch(loadReferences(profileId));
  }, [dispatch, profileId]);

  return useSelector((state) => state.data.references);
}

export function useDocuments(profileId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (profileId) dispatch(loadDocuments(profileId));
  }, [dispatch, profileId]);

  return useSelector((state) => state.data.documents.all);
}

export function useDocumentsByFolder(profileId, folderId) {
  const dispatch = useDispatch();
  const key = folderKey(folderId);

  useEffect(() => {
    if (profileId) dispatch(loadDocumentsByFolder({ profileId, folderId }));
  }, [dispatch, profileId, folderId]);

  return useSelector((state) => state.data.documents.byFolder[key] ?? []);
}

export function useFolders(profileId) {
  const dispatch = useDispatch();
  const folders = useSelector((state) => state.data.folders);

  useEffect(() => {
    if (profileId) dispatch(loadFolders(profileId));
  }, [dispatch, profileId]);

  const tree = useMemo(() => {
    function buildTree(parentId = null) {
      return folders
        .filter((folder) => (folder.parentId ?? null) === parentId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
        .map((folder) => ({ folder, children: buildTree(folder.id) }));
    }

    return buildTree();
  }, [folders]);

  const createFolder = useCallback(
    (name, parentId = null, extra = {}) => dispatch(createFolderThunk({ profileId, name, parentId, extra })).unwrap(),
    [dispatch, profileId],
  );

  const renameFolder = useCallback(
    (id, name) => dispatch(renameFolderThunk({ profileId, id, name })).unwrap(),
    [dispatch, profileId],
  );

  const updateFolder = useCallback(
    (id, data) => dispatch(updateFolderThunk({ profileId, id, data })).unwrap(),
    [dispatch, profileId],
  );

  const deleteFolder = useCallback(
    (id) => dispatch(deleteFolderThunk({ profileId, id })).unwrap(),
    [dispatch, profileId],
  );

  return { folders, tree, createFolder, renameFolder, updateFolder, deleteFolder };
}

export function useTasks(profileId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (profileId) dispatch(loadTasks(profileId));
  }, [dispatch, profileId]);

  return useSelector((state) => state.data.tasks);
}

export function useAiSuggestions(documentId) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (documentId) dispatch(loadAiSuggestions(documentId));
  }, [dispatch, documentId]);

  return useSelector((state) => state.data.aiSuggestions.byDocument[documentId] ?? []);
}
