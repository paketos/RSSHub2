import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import * as url from 'node:url';

export const route: Route = {
    path: '/zxdt/:id?',
    categories: ['travel'],
    example: '/12306/zxdt',
    parameters: { id: '铁路局id，可在 URL 中找到，不填默认显示所有铁路局动态' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['www.12306.cn/', 'www.12306.cn/mormhweb/1/:id/index_fl.html'],
            target: '/zxdt/:id',
        },
    ],
    name: '最新动态',
    maintainers: ['LogicJake'],
    handler,
    url: 'www.12306.cn/',
};

async function handler(ctx) {
    const id = ctx.req.param('id') || -1;

    const link = id === -1 ? 'https://www.12306.cn/mormhweb/zxdt/index_zxdt.html' : `https://www.12306.cn/mormhweb/1/${id}/index_fl.html`;

    const response = await got.get(link);
    const data = response.data;
    const $ = load(data);
    const name = $('div.nav_center > a:nth-child(4)').text();

    const list = $('#newList > ul > li')
        .map(function () {
            const info = {
                title: $(this).find('a').text(),
                link: $(this).find('a').attr('href'),
                date: $(this).find('span').text().slice(1, -1),
            };
            return info;
        })
        .get();

    const out = await Promise.all(
        list.map(async (info) => {
            const title = info.title;
            const date = info.date;
            const itemUrl = url.resolve(link, info.link);

            const cacheIn = await cache.get(itemUrl);
            if (cacheIn) {
                return JSON.parse(cacheIn);
            }

            const response = await got.get(itemUrl);
            const $ = load(response.data);
            let description = $('.article-box').html();
            description = description ? description.replaceAll('src="', `src="${url.resolve(itemUrl, '.')}`).trim() : $('.content_text').html() || '文章已被删除';

            const single = {
                title,
                link: itemUrl,
                description,
                pubDate: new Date(date).toUTCString(),
            };
            cache.set(itemUrl, JSON.stringify(single));
            return single;
        })
    );

    return {
        title: `${name}最新动态`,
        link,
        item: out,
    };
}
