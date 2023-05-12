import { serve } from "https://deno.land/std@0.187.0/http/server.ts";

const routes = {
  home: new URLPattern({ pathname: "/" }),
  note: new URLPattern({ pathname: "/:id" }),
};

const db = await Deno.openKv();

serve(async (req: Request) => {
  const authorization = req.headers.get("authorization");

  if (!authorization || !checkAuthorization(authorization)) {
    return new Response("401 Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
      headers: {
        "www-authenticate": `Basic realm="Basic Authentication"`,
      },
    });
  }

  if (routes.home.test(req.url)) {
    const allNotes = db.list<string>({ prefix: ["notes"] });
    const notes: string[] = [];

    for await (const { key } of allNotes) {
      notes.push(key[1] as string);
    }

    return new Response(indexNote(notes), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const route = routes.note.exec(req.url);

  if (route) {
    const id = decodeURI(route.pathname.groups.id!) as string;
    const note = await db.get<string>(["notes", id]);

    if (req.method === "POST") {
      const body = await req.text();
      if (body.trim() === "") {
        await db.delete(["notes", id]);
      } else {
        await db.set(["notes", id], body);
      }
      return new Response("OK");
    }

    return new Response(templateNote(id, note.value), {
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response(layout("Not found", "Notes"), {
    headers: { "Content-Type": "text/html" },
    status: 404,
  });
});

function indexNote(notes: string[]) {
  return layout(
    `
    <ul>
      ${
      notes
        .map((id) => `<li><a href="/${id}">${id}</a></li>`)
        .join("")
    }
    </ul>
    <form action="/" method="GET" id="new">
      <input type="text" name="name" required placeholder="Title of the note" autofocus>
      <button class="button">New note</button>
    </form>
    <script type="module">
      const form = document.getElementById('new');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const name = new FormData(form).get('name');
        if (name) {
          document.location = '/' + name;
        }
      });
    </script>
  `,
    "Notes",
  );
}

function templateNote(title: string, content: string | null) {
  return layout(
    `
    <textarea id="text" placeholder="Write here your notes" autofocus>${
      content || ""
    }</textarea>
    <a class="button is-floating" href="../">Back</a>

    <script type="module">
        const textarea = document.getElementById('text');
        const button = document.getElementById('delete');

        let sending = false;
        textarea.addEventListener('keyup', function () {
          if (sending) return;
          sending = true;
          fetch(location.pathname, { method: 'POST', body: this.value })
            .then(() => sending = false);
        });
    </script>
  `,
    title,
  );
}

function layout(content: string, title: string) {
  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/modern-normalize/1.1.0/modern-normalize.min.css">
        <style type="text/css">
          body {
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          ul {
            list-style: none;
            padding: 0;
          }
          ul a {
            display: block;
            padding: 1em;
            color: #000;
            text-decoration: none;
            font-weight: bold;
          }
          ul a:hover {
            background: #eee;
          }
          li + li {
            border-top: 1px solid #eee;
          }
          textarea {
            width: 100%;
            height: calc(100vh - 40px);
            border: none;
            resize: none;
            padding: 20px;
            line-height: 1.6;
            outline: 0;
          }
          textarea:focus-visible {
            outline: 0;
          }
          form {
            display: flex;
          }
          input[type="text"] {
            padding: 1em;
            background: #efefef;
            border: none;
            flex: 1;
            outline: 0;
          }
          input[type="text"]:focus {
            background: #eee;
          }
          .button {
            border: none;
            padding: 1em;
            background: #000;
            color: #fff;
            text-decoration: none;
            cursor: pointer;
          }
          .button:hover {
            background: #333;
          }
          .is-floating {
            position: fixed;
            bottom: 20px;
            right: 20px;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
    </html>
  `;
}

function checkAuthorization(authorization: string): boolean {
  const match = authorization.match(/^Basic\s+(.*)$/);

  if (match) {
    const [user, password] = atob(match[1]).split(":");
    return Deno.env.get("USER") === user &&
      Deno.env.get("PASSWORD") === password;
  }

  return false;
}
