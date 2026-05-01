import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'feather';
                src: url('/fonts/Feather.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: block;
              }
              @font-face {
                font-family: 'Material Design Icons';
                src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: block;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
