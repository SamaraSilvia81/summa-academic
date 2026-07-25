import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getSession,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
} from '../../lib/auth';
import { ProfileRepo, SettingsRepo } from '../../services/repositories';

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

async function resolveProfile(user) {
  if (!user?.id) return null;
  return ProfileRepo.getByUserId(user.id);
}

export const initializeAuth = createAsyncThunk('auth/initialize', async () => {
  const session = await getSession();
  const user = session?.user ?? null;
  const profile = await resolveProfile(user);

  return { session, user, profile };
});

export const refreshProfile = createAsyncThunk('auth/refreshProfile', async (_, { getState }) => {
  const { user } = getState().auth;
  return resolveProfile(user);
});

export const createProfile = createAsyncThunk(
  'auth/createProfile',
  async ({ profile, settings = {} }, { getState }) => {
    const state = getState();
    const userId = profile.userId ?? state.auth.user?.id;

    if (!userId) {
      throw new Error('Entre no Summa antes de concluir o onboarding.');
    }

    const payload = cleanPayload({ ...profile, userId });
    const profileId = await ProfileRepo.create(payload);

    if (!profileId) {
      throw new Error('Nao foi possivel criar o perfil no Supabase. Confira as policies de RLS da tabela profiles.');
    }

    await SettingsRepo.create(profileId, settings);
    return ProfileRepo.getById(profileId);
  },
);

export const signInWithPassword = createAsyncThunk('auth/signInWithPassword', async ({ email, password }) => {
  const data = await signIn(email, password);
  const session = data.session ?? null;
  const user = session?.user ?? null;
  const profile = await resolveProfile(user);

  return { session, user, profile };
});

export const signUpWithPassword = createAsyncThunk('auth/signUpWithPassword', async ({ email, password, name, avatarUrl }) => {
  const metadata = {};
  if (name) metadata.full_name = name;
  if (avatarUrl) metadata.avatar_url = avatarUrl;

  const data = await signUp(email, password, metadata);
  const session = data.session ?? null;
  const user = data.user ?? session?.user ?? null;
  const profile = await resolveProfile(user);

  return { session, user, profile };
});

export const signInWithGoogleProvider = createAsyncThunk('auth/signInWithGoogle', async () => {
  await signInWithGoogle();
});

export const signOutUser = createAsyncThunk('auth/signOut', async () => {
  await signOut();
});

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async ({ profileId, data }, { getState }) => {
    const state = getState();
    const userId = state.auth.user?.id;
    if (!userId) throw new Error('Sessão expirada.');

    const updated = await ProfileRepo.update(profileId, { ...data, updatedAt: new Date() });
    if (!updated) throw new Error('Erro ao atualizar perfil.');
    return updated;
  },
);

const initialState = {
  session: null,
  user: null,
  profile: null,
  status: 'idle',
  error: null,
};

const setLoading = (state) => {
  state.status = 'loading';
  state.error = null;
};

const setFailed = (state, action) => {
  state.status = 'failed';
  state.error = action.error.message;
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action) {
      const session = action.payload ?? null;
      state.session = session;
      state.user = session?.user ?? null;
    },
    clearAuthState(state) {
      state.session = null;
      state.user = null;
      state.profile = null;
      state.status = 'ready';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeAuth.pending, setLoading)
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.profile = action.payload.profile;
        state.status = 'ready';
      })
      .addCase(initializeAuth.rejected, setFailed)
      .addCase(refreshProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.status = 'ready';
      })
      .addCase(createProfile.pending, setLoading)
      .addCase(createProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.status = 'ready';
      })
      .addCase(createProfile.rejected, setFailed)
      .addCase(signInWithPassword.pending, setLoading)
      .addCase(signInWithPassword.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.profile = action.payload.profile;
        state.status = 'ready';
      })
      .addCase(signInWithPassword.rejected, setFailed)
      .addCase(signUpWithPassword.pending, setLoading)
      .addCase(signUpWithPassword.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.user = action.payload.user;
        state.profile = action.payload.profile;
        state.status = 'ready';
      })
      .addCase(signUpWithPassword.rejected, setFailed)
      .addCase(signInWithGoogleProvider.pending, setLoading)
      .addCase(signInWithGoogleProvider.rejected, setFailed)
      .addCase(signOutUser.fulfilled, (state) => {
        state.session = null;
        state.user = null;
        state.profile = null;
        state.status = 'ready';
      })
      .addCase(updateProfile.pending, setLoading)
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.status = 'ready';
      })
      .addCase(updateProfile.rejected, setFailed);
  },
});

export const { clearAuthState, setSession } = authSlice.actions;
export const selectAuth = (state) => state.auth;
export const selectProfile = (state) => state.auth.profile;
export default authSlice.reducer;
