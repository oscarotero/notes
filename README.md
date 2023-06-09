# Notes

Minimalist notepad for Deno Deploy. It uses [Deno KV](https://deno.com/kv) to store the data.

## Run

```sh
USER=your_user PASSWORD=your_password deno run --allow-net --allow-env=USER,PASSWORD --unstable server.ts
```
