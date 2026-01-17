/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: 'https://hoklampung.com',
    generateRobotsTxt: true,
    generateIndexSitemap: false,
    changefreq: 'daily',
    priority: 0.7,
    exclude: ['/admin/*', '/api/*', '/pdfpage'],
    robotsTxtOptions: {
        policies: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/admin/', '/api/'],
            },
        ],
    },
}
