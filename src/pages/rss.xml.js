import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { isPublishedEntryData } from '../utils/publishing';

export async function GET(context) {
	const posts = await getCollection('blog', ({ data }) => isPublishedEntryData(data));
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: `/notebook/${post.id}/`,
		})),
	});
}
