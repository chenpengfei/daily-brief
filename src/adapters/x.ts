import { readFile } from "node:fs/promises";
import { getCredential, resolveDailyBriefPaths } from "../config/index.js";
import { createSourceItem, type Source, type SourceItem } from "../domain/index.js";
import type { FetchAdapter, FetchContext } from "./types.js";

export interface XFetchAdapterOptions {
  fetchImpl?: typeof fetch;
  authPath?: string;
  credentialRef?: string;
}

type XPostType = "original" | "repost" | "quote" | "reply";
type XTarget =
  | { kind: "profile"; username: string }
  | { kind: "fixture"; path: string }
  | { kind: "remote-json"; url: string };

interface XPost {
  id: string;
  url: string;
  text: string;
  author?: string;
  createdAt?: string;
  type?: XPostType;
  addedText?: string;
  metadata?: Record<string, unknown>;
}

interface XApiTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  conversation_id?: string;
  referenced_tweets?: Array<{ type: "retweeted" | "quoted" | "replied_to"; id: string }>;
  public_metrics?: Record<string, number>;
  lang?: string;
}

interface XApiUser {
  id: string;
  username: string;
  name?: string;
  url?: string;
  verified?: boolean;
}

interface XApiResponse<T> {
  data?: T;
  includes?: {
    tweets?: XApiTweet[];
    users?: XApiUser[];
  };
  errors?: Array<{ title?: string; detail?: string }>;
}

const X_CREDENTIAL_REF = "x.default";
const X_API_BASE_URL = "https://api.twitter.com/2";
const X_TIMELINE_MAX_RESULTS = "10";

export function createXFetchAdapter(options: XFetchAdapterOptions = {}): FetchAdapter {
  return {
    name: "x",
    readiness: "live-capable",
    async fetch(source: Source, context: FetchContext): Promise<SourceItem[]> {
      const posts = await readXPosts(source.target, options, context);

      return posts.filter(shouldKeepPost).map((post) =>
        createSourceItem({
          id: `${source.id}:${post.id}`,
          sourceId: source.id,
          platform: source.platform,
          url: post.url,
          title: `${post.author ?? source.id}: ${firstLine(post.addedText ?? post.text)}`,
          fetchedAt: context.fetchedAt.toISOString(),
          analyzableText: post.addedText ? `${post.addedText}\n\nReferenced X context: ${post.text}` : post.text,
          metadata: {
            postType: post.type ?? "original",
            sourceTarget: source.target,
            ...(post.metadata ?? {})
          },
          ...(post.author ? { author: post.author } : {}),
          ...(post.createdAt ? { publishedAt: post.createdAt } : {})
        })
      );
    }
  };
}

export const xFetchAdapter = createXFetchAdapter();

export function parseXProfileTarget(target: string): string {
  const parsed = parseXTarget(target);

  if (parsed.kind !== "profile") {
    throw new Error(`Unsupported X target: ${target}. Use an X profile target such as @handle or https://x.com/handle.`);
  }

  return parsed.username;
}

async function readXPosts(target: string, options: XFetchAdapterOptions, context: FetchContext): Promise<XPost[]> {
  const parsedTarget = parseXTarget(target);

  if (parsedTarget.kind === "profile") {
    return fetchXProfilePosts(parsedTarget.username, options, context);
  }

  if (parsedTarget.kind === "remote-json") {
    const body = await readRemoteFixtureTarget(parsedTarget.url, options.fetchImpl ?? fetch, context.signal);
    return parseFixturePosts(body);
  }

  const body = await readFile(parsedTarget.path, "utf8");
  return parseFixturePosts(body);
}

function parseXTarget(target: string): XTarget {
  const trimmed = target.trim();

  if (!trimmed) {
    throw new Error("Unsupported X target: target must not be empty");
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return parseXUrlTarget(trimmed);
  }

  if (trimmed.startsWith("@")) {
    return { kind: "profile", username: readHandle(trimmed.slice(1), target) };
  }

  if (isHandle(trimmed)) {
    return { kind: "profile", username: trimmed };
  }

  if (looksLikeFilePath(trimmed)) {
    return { kind: "fixture", path: trimmed };
  }

  throw new Error(`Unsupported X target: ${target}. Use @handle, handle, https://x.com/handle, or https://twitter.com/handle.`);
}

function parseXUrlTarget(target: string): XTarget {
  let url: URL;

  try {
    url = new URL(target);
  } catch {
    throw new Error(`Unsupported X target: malformed URL ${target}`);
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host !== "x.com" && host !== "twitter.com") {
    return { kind: "remote-json", url: target };
  }

  const profileSegment = segments[0];
  if (segments.length === 1 && !url.search && profileSegment && isHandle(profileSegment)) {
    return { kind: "profile", username: profileSegment };
  }

  if (segments[0] === "search") {
    throw new Error("Unsupported X target: search targets are not supported; configure an X profile target instead.");
  }

  if (segments[0] === "i" && segments[1] === "lists") {
    throw new Error("Unsupported X target: list targets are not supported; configure an X profile target instead.");
  }

  if (segments[1] === "status" || segments[1] === "statuses") {
    throw new Error("Unsupported X target: status targets are not supported; configure an X profile target instead.");
  }

  throw new Error(`Unsupported X target: ${target}. Use a profile URL such as https://x.com/handle.`);
}

async function fetchXProfilePosts(
  username: string,
  options: XFetchAdapterOptions,
  context: FetchContext
): Promise<XPost[]> {
  const credentialRef = options.credentialRef ?? X_CREDENTIAL_REF;
  const bearerToken = readXBearerToken(credentialRef, options.authPath ?? context.authPath ?? resolveDailyBriefPaths().authPath);
  const fetchImpl = options.fetchImpl ?? fetch;
  const user = await fetchXUserByUsername(username, bearerToken, fetchImpl, context.signal);
  const timeline = await fetchXUserTimeline(user.id, bearerToken, fetchImpl, context.signal);
  const users = new Map<string, XApiUser>([
    [user.id, user],
    ...((timeline.includes?.users ?? []).map((includedUser) => [includedUser.id, includedUser] as const))
  ]);
  const includedTweets = new Map((timeline.includes?.tweets ?? []).map((tweet) => [tweet.id, tweet]));

  return (timeline.data ?? []).map((tweet) => mapXApiTweet(tweet, user, users, includedTweets));
}

function readXBearerToken(credentialRef: string, authPath: string): string {
  const credential = getCredential(credentialRef, authPath);

  if (!credential) {
    throw new Error(
      `X API credential ${credentialRef} is missing from auth.json; store an api-key credential with provider "x".`
    );
  }

  if (credential.type !== "api-key" || credential.provider !== "x") {
    throw new Error(`X API credential ${credentialRef} must be an api-key credential with provider "x".`);
  }

  return credential.apiKey;
}

async function fetchXUserByUsername(
  username: string,
  bearerToken: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined
): Promise<XApiUser> {
  const url = new URL(`${X_API_BASE_URL}/users/by/username/${encodeURIComponent(username)}`);
  url.searchParams.set("user.fields", "id,username,name,url,verified");
  const response = await fetchXJson<XApiResponse<XApiUser>>(url, bearerToken, fetchImpl, signal, "username lookup");

  if (!response.data) {
    throw new Error(`X API username lookup returned no user for ${username}.`);
  }

  return response.data;
}

async function fetchXUserTimeline(
  userId: string,
  bearerToken: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined
): Promise<XApiResponse<XApiTweet[]>> {
  const url = new URL(`${X_API_BASE_URL}/users/${encodeURIComponent(userId)}/tweets`);
  url.searchParams.set("max_results", X_TIMELINE_MAX_RESULTS);
  url.searchParams.set("exclude", "retweets");
  url.searchParams.set("tweet.fields", "id,text,created_at,author_id,conversation_id,referenced_tweets,public_metrics,lang");
  url.searchParams.set("expansions", "author_id,referenced_tweets.id,referenced_tweets.id.author_id");
  url.searchParams.set("user.fields", "id,username,name,url,verified");

  return fetchXJson<XApiResponse<XApiTweet[]>>(url, bearerToken, fetchImpl, signal, "user posts timeline");
}

async function fetchXJson<T>(
  url: URL,
  bearerToken: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal | undefined,
  operation: string
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json"
    },
    ...(signal ? { signal } : {})
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`X API ${operation} failed with ${response.status}: ${formatXApiError(body)}`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`X API ${operation} returned invalid JSON.`);
  }
}

function formatXApiError(body: string): string {
  if (!body.trim()) {
    return "empty response; check x.default credential and X API access";
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed) && Array.isArray(parsed.errors)) {
      const first = parsed.errors.find(isRecord);
      const title = typeof first?.title === "string" ? first.title : undefined;
      const detail = typeof first?.detail === "string" ? first.detail : undefined;
      return [title, detail].filter(Boolean).join(" - ") || "check x.default credential and X API access";
    }
  } catch {
    return "non-JSON response; check x.default credential and X API access";
  }

  return "check x.default credential and X API access";
}

function mapXApiTweet(
  tweet: XApiTweet,
  sourceUser: XApiUser,
  users: Map<string, XApiUser>,
  includedTweets: Map<string, XApiTweet>
): XPost {
  const author = users.get(tweet.author_id ?? sourceUser.id) ?? sourceUser;
  const postType = classifyApiTweet(tweet);
  const referenced = (tweet.referenced_tweets ?? []).flatMap((reference) => {
    const included = includedTweets.get(reference.id);
    if (!included) {
      return [];
    }

    const referencedAuthor = users.get(included.author_id ?? "");
    return [
      {
        id: included.id,
        type: reference.type,
        text: included.text,
        url: xStatusUrl(referencedAuthor?.username ?? sourceUser.username, included.id),
        ...(referencedAuthor ? { author: formatXAuthor(referencedAuthor), username: referencedAuthor.username } : {})
      }
    ];
  });
  const referencedContext = referenced.map((reference) => `${reference.type}: ${reference.text}`).join("\n\n");

  return {
    id: tweet.id,
    url: xStatusUrl(author.username, tweet.id),
    text: referencedContext || tweet.text,
    author: formatXAuthor(author),
    ...(tweet.created_at ? { createdAt: tweet.created_at } : {}),
    type: postType,
    ...(referencedContext ? { addedText: tweet.text } : {}),
    metadata: {
      xPostId: tweet.id,
      xUserId: sourceUser.id,
      username: author.username,
      profileUrl: xProfileUrl(sourceUser.username),
      referencedTweets: referenced,
      ...(tweet.conversation_id ? { conversationId: tweet.conversation_id } : {}),
      ...(tweet.public_metrics ? { publicMetrics: tweet.public_metrics } : {}),
      ...(tweet.lang ? { lang: tweet.lang } : {})
    }
  };
}

async function readRemoteFixtureTarget(target: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<string> {
  const response = await fetchImpl(target, signal ? { signal } : undefined);

  if (!response.ok) {
    throw new Error(`X target returned ${response.status}`);
  }

  return response.text();
}

function parseFixturePosts(body: string): XPost[] {
  const parsed = JSON.parse(body) as unknown;
  const posts = isRecord(parsed) && Array.isArray(parsed.posts) ? parsed.posts : Array.isArray(parsed) ? parsed : undefined;

  if (!posts) {
    throw new Error("X adapter fixture/response must contain a posts list");
  }

  return posts.map(parseXPost);
}

function parseXPost(value: unknown): XPost {
  if (!isRecord(value)) {
    throw new Error("X post must be an object");
  }

  const id = readString(value, "id");
  const url = readString(value, "url");
  const text = readString(value, "text");
  const type = optionalPostType(value.type);
  const author = optionalString(value.author);
  const createdAt = optionalString(value.createdAt ?? value.created_at);
  const addedText = optionalString(value.addedText ?? value.added_text);

  return {
    id,
    url,
    text,
    ...(type ? { type } : {}),
    ...(author ? { author } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(addedText ? { addedText } : {})
  };
}

function shouldKeepPost(post: XPost): boolean {
  return (post.type ?? "original") !== "repost";
}

function classifyApiTweet(tweet: XApiTweet): XPostType {
  const references = tweet.referenced_tweets ?? [];

  if (references.some((reference) => reference.type === "retweeted")) {
    return "repost";
  }

  if (references.some((reference) => reference.type === "quoted")) {
    return "quote";
  }

  if (references.some((reference) => reference.type === "replied_to")) {
    return "reply";
  }

  return "original";
}

function xProfileUrl(username: string): string {
  return `https://x.com/${username}`;
}

function xStatusUrl(username: string, id: string): string {
  return `${xProfileUrl(username)}/status/${id}`;
}

function formatXAuthor(user: XApiUser): string {
  return user.username ? `@${user.username}` : user.name ?? user.id;
}

function firstLine(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 96);
}

function readHandle(handle: string, target: string): string {
  if (!isHandle(handle)) {
    throw new Error(`Unsupported X target: malformed profile handle in ${target}.`);
  }

  return handle;
}

function isHandle(value: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(value);
}

function looksLikeFilePath(value: string): boolean {
  return value.startsWith(".") || value.startsWith("/") || value.includes("/") || value.endsWith(".json");
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = optionalString(source[key]);

  if (!value) {
    throw new Error(`X post ${key} must be a non-empty string`);
  }

  return value;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalPostType(value: unknown): XPostType | undefined {
  if (value === "original" || value === "repost" || value === "quote" || value === "reply") {
    return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
