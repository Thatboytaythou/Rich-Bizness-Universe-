import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=identity-owner-2';
import {
  loadSportsPosts,
  loadSportsSystems,
  loadSportsProfile,
  loadSportsSocial,
  addSportsComment,
  addSportsReaction,
  createSportsPick,
  watchSports
} from './data.js';
import {
  mountSportsSystems,
  renderSportsPosts,
  renderSportsProfile,
  renderSportsSystems,
  renderSportsSocial
} from './ui.js';

const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  profile: null,
  rows: [],
  sourceTable: 'sports_posts',
  selectedPost: null
};

let stopWatching = null;
let postsTimer = null;
let systemsTimer = null;
let loadingPosts = false;
let loadingSocial = false;
let loadingSystems = false;

async function loadIdentity() {
  const identity = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  state.user = identity.user || null;
  state.profile = identity.profile || null;
}

async function loadPosts() {
  if (loadingPosts) return;
  loadingPosts = true;
  const selectedId = state.selectedPost?.id || null;
  try {
    const result = await loadSportsPosts();
    state.rows = result.rows;
    state.sourceTable = result.sourceTable;
    state.selectedPost = selectedId ? state.rows.find((row) => row.id === selectedId) || null : null;
    if (!state.selectedPost && state.rows.length && state.sourceTable === 'sports_posts') state.selectedPost = state.rows[0];
    renderSportsPosts({
      rows: state.rows,
      selectedId: state.selectedPost?.id,
      onSelect: selectPost
    });
    restartRealtime();
    if (state.selectedPost) await loadSocial();
  } finally {
    loadingPosts = false;
  }
}

async function selectPost(index) {
  state.selectedPost = state.rows[index] || null;
  renderSportsPosts({
    rows: state.rows,
    selectedId: state.selectedPost?.id,
    onSelect: selectPost
  });
  restartRealtime();
  await loadSocial();
}

async function loadSocial() {
  if (loadingSocial) return;
  loadingSocial = true;
  try {
    const enabled = Boolean(state.selectedPost?.id && state.sourceTable === 'sports_posts');
    const social = enabled ? await loadSportsSocial(state.selectedPost.id) : { comments: [], reactions: 0 };
    renderSportsSocial({
      post: state.selectedPost,
      comments: social.comments,
      reactions: social.reactions,
      enabled
    });
  } finally {
    loadingSocial = false;
  }
}

async function loadSystems() {
  if (loadingSystems) return;
  loadingSystems = true;
  try {
    renderSportsSystems(await loadSportsSystems());
  } finally {
    loadingSystems = false;
  }
}

async function loadProfile() {
  renderSportsProfile(await loadSportsProfile(state.user?.id));
}

async function submitComment() {
  const input = $('#sportsCommentBody');
  const body = input?.value || '';
  if (input) input.value = '';
  await addSportsComment({
    postId: state.selectedPost?.id,
    user: state.user,
    profile: state.profile,
    body
  });
  await loadSocial();
}

async function submitReaction() {
  await addSportsReaction({
    postId: state.selectedPost?.id,
    userId: state.user?.id
  });
  await loadSocial();
}

async function submitPick(event) {
  event.preventDefault();
  await createSportsPick({
    user: state.user,
    profile: state.profile,
    title: $('#sportsPickTitle')?.value?.trim(),
    teamName: $('#sportsPickTeam')?.value?.trim(),
    opponent: $('#sportsPickOpponent')?.value?.trim(),
    prediction: $('#sportsPickPrediction')?.value?.trim()
  });
  event.target.reset();
  await loadSystems();
}

function schedulePosts() {
  clearTimeout(postsTimer);
  postsTimer = setTimeout(loadPosts, 180);
}

function scheduleSystems() {
  clearTimeout(systemsTimer);
  systemsTimer = setTimeout(loadSystems, 180);
}

function restartRealtime() {
  stopWatching?.();
  stopWatching = watchSports({
    postId: state.sourceTable === 'sports_posts' ? state.selectedPost?.id : null,
    posts: schedulePosts,
    social: loadSocial,
    systems: scheduleSystems
  });
}

function cleanup() {
  clearTimeout(postsTimer);
  clearTimeout(systemsTimer);
  stopWatching?.();
  stopWatching = null;
}

mountSportsSystems();
loadIdentity().then(async () => {
  await Promise.all([loadPosts(), loadSystems(), loadProfile()]);
  restartRealtime();
});

$('#sportsCommentBtn')?.addEventListener('click', submitComment);
$('#sportsReactBtn')?.addEventListener('click', submitReaction);
$('#sportsPickForm')?.addEventListener('submit', submitPick);
window.addEventListener('pagehide', cleanup, { once: true });