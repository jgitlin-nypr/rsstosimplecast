const podcastFeedParser = require("podcast-feed-parser");
const basename = require('path').basename;
const fetch = require('node-fetch');

const feedUrl = "https://www.wnycstudios.org/feeds/shows/tnyradiohour?limit=4000&audio_suffix=%26delivery=premium";
const authToken = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJzaW1wbGVjYXN0IiwiYyI6Ijc2YTZmODQ5LTA5NmUtNDYzOC1hZDNmLWJhNTU2MzJjYjQxMCIsImV4cCI6MTY5NzgxODY3NiwiaCI6Imh0dHBzOi8vb2F1dGhkZWJ1Z2dlci5jb20vIiwiaWF0IjoxNjk3MjEzODc2LCJpc3MiOiJzaW1wbGVjYXN0IiwianRpIjoiMnU2cmUxcTdmZmwyZ2F1cmFvNDk5cjMxIiwibmJmIjoxNjk3MjEzODc2LCJzdWIiOiJqcGFzc21vcmVAbnlwdWJsaWNyYWRpby5vcmciLCJ1aWQiOiIzYjYwODhkMy1lZDAxLTRjOGYtYjBhZi1iY2JkNzIwMzViY2YifQ.ukjA8KxzSB_a4cITYtQuag60rAhlTHcjTdU0X3uVFRfdfq3CBLZl7hAMD1uGVm4AexY2dxJgEgJU88l_GEemwA';
const test_season_id = '578b8fba-2e10-4b7b-ab72-d837d4b6bd07';
const test_show_id = 'c159b94a-a68f-42b8-8851-1ae2f97d9f3f';
const nyrh_test_season_id = 'd8e6de37-bc1a-454d-b4e4-a3dddce1952c';
const nyrh_test_show_id = '601e911c-a988-4d08-9e6f-f6532eaf8a0a';

const show_id = nyrh_test_show_id;
const season_id = nyrh_test_season_id;

const api_base = `https://api.simplecast.com/podcasts/${show_id}/episodes`;

// for fetching remote feeds, use getPodcastFromURL.
// Note that function must be async
async function printPodcastTitle (url) {
	const options = {
		fields : {
		  'meta': ['default', 'webMaster'],
		  'episodes': ['default', 'media:thumbnail', 'category']
		},
		uncleaned: {
			'episodes': ['category']
		}
	  }
	  
	const podcast = await podcastFeedParser.getPodcastFromURL(url, options)
	podcast.episodes.forEach(async (episode) => {
		console.log(episode)
		if (episode && episode.enclosure && episode.enclosure.url) {
			try {
				const data = {
					type: 'full',
					season_id: season_id,
					fileUrl: episode.enclosure.url,
					title: episode.title,
					keywords: episode.category,
					description: episode.description,
					image_path: episode['media:thumbnail']['$'].url
				}
				console.log(data);
				console.log('filename', basename(data.fileUrl.substring(0, data.fileUrl.indexOf('?'))));
				await loadEpisode(data);
			} catch (e) {
				console.warn("Could not load episode", e);
			}
		}
	})
}

async function loadEpisode(data) {
	const posted = await fetch(api_base, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${authToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data)
	});
	const response = await posted.json();
	console.log("response", response.status, response);
	console.log(response.keywords.create);
	const episodeId = response.id;
	const audioUrl = response.audio.href;
	const signed_url = await createAudio(audioUrl, data.fileUrl);
	console.log('signed url', signed_url);
	const uploadComplete = response.upload_complete.href;
	const setKeywordsUrl = response.keywords.create.action;
	data.keywords.forEach(async (kw) => {
		await addKeyword(setKeywordsUrl, kw);
	})
}

async function createAudio(audioUrl, fileUrl) {
	const posted = await fetch(audioUrl, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${authToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			file_name: 	basename(fileUrl.substring(0, fileUrl.indexOf('?')))
		})
	});
	const res = await posted.json();
	console.log(res);
	console.log(res.signed_url);
	console.log(fileUrl);
	const mp3Response = await fetch(fileUrl, {
		method: 'GET',
		redirect: 'follow'
	});
	console.log('file url', mp3Response.url, 'status', mp3Response.status);
	const upload = await fetch(res.signed_url, {
		method: 'PUT',
		headers: {
			'Content-Type': 'audio/mpeg'
		},
		body: await mp3Response.arrayBuffer()
	});
	console.log('upload initiated');
	const uploaded = await upload;
	console.log('uploaded', uploaded.status);
	return res.signed_url
}

async function addKeyword(kwUrl, kw) {
	const setkw = await fetch(kwUrl, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${authToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			keyword: kw
		})
	});
	const kwresponse = await setkw.json();
	console.log("keywords", kwresponse);
}

console.log("fetching", feedUrl);
printPodcastTitle(feedUrl);