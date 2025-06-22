1. Download your favicon package. (Downloaded and put in docs/)
2. Extract this package in the root of your web site. If your site is http://www.example.com, you should be able to access a file named http://www.example.com/favicon.ico.
3. Insert the following code in the <head> section of your pages:
<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-title" content="Vokan" />
<link rel="manifest" href="/site.webmanifest" />
