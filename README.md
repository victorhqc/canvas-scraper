# canvas-scraper

Web Scraper para la plataforma de educación "Canvas"

## Motivación

La plataforma "Canvas" es una herramienta de educación utilizada por la Universidad de la Rioja
Internacional ([https://mexico.unir.net/](https://mexico.unir.net/)). La manera en que el material
para el estudiante se sube, no es la forma más ergonómica que existe, ya que sólo se puede leer
en el navegador, y carece de funcionalidades como buscador, marcatextos, etc.

En mi opinión personal, es mejor tener el texto con las imágenes en un formato "Markdown" y poder
exportar ese texto a cualquier otro formato que sea necesario, como PDF, Doc, etc.

Este repositorio es el sucesor del
[primer intento](https://github.com/victorhqc/ARCHIVED_canvas-scraper).

## Alcance

El proyecto tiene como alcance generar una aplicación para la terminal (CLI) que pueda:

- Iniciar sesión en Canvas (Necesario para poder realizar el scraping)
- Convertir el material en HTML a un archivo Markdown
- Automáticamente descargar las imágenes y usarlas en el archivo Markdown.

El formateo post Markdown no forma parte de la especificación y se recomienda utilizar otras
herramientas como Pandoc y LateX.

## Desarrollo

### Requisitos

- Rust >= 1.39

### Ejecución

```sh
cargo run

cargo run login

cargo run login -- --help

## Debug mode
CARGO_LOG=canvas-scraper=debug cargo run
```
