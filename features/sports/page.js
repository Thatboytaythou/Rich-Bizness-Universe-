import { getAuthoritativeIdentity } from '../../src/rb-identity.js?v=profile-avatar-separate-1';
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

async function loadIdentity() {
  const identity = await getAuthoritativeIdentity({ fresh: true }).catch(() => ({}));
  state.user = identity.user || null;
  state.profile = identity.profile || null;
}

async function loadPosts() {
  const result = await loadSportsPosts();
  state.rows = result.rows;
  state.sourceTable = result.sourceTable;
  if (!state.selectedPost && state.rows.length && state.sourceTable === 'sports_posts') state.selectedPost = state.rows[0];
  renderSportsPosts({
    rows: state.rows,
    selectedId: state.selectedPost?.id,
    onSelect: selectPost
  });
  if (state.selectedPost) await loadSocial();
}

async function selectPost(index) {
  state.selectedPost = state.rows[index] || null;
  renderSportsPosts({
    rows: state.rows,
    selectedId: state.selectedPost?.id,
    onSelect: selectPost
  });
  await loadSocial();
}

async function loadSocial() {
  const enabled = Boolean(state.selectedPost?.id && state.sourceTable === 'sports_posts');
  const social = enabled ? await loadSportsSocial(state.selectedPost.id) : { comments: [], reactions: 0 };
  renderSportsSocial({
    post: state.selectedPost,
    comments: social.comments,
    reactions: social.reactions,
    enabled
  });
}

async function loadSystems() {
  renderSportsSystems(await loadSportsSystems());
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

mountSportsSystems();
loadIdentity().then(async () => {
  await Promise.all([loadPosts(), loadSystems(), loadProfile()]);
});

$('#sportsCommentBtn')?.addEventListener('click', submitComment);
$('#sportsReactBtn')?.addEventListener('click', submitReaction);
$('#sportsPickForm')?.addEventListener('submit', submitPick);

watchSports({
  posts: loadPosts,
  social: loadSocial,
  systems: loadSystems
});
