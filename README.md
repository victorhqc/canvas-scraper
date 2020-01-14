# canvas-scraper

Web Scraper para la plataforma de educación "Canvas"

![](https://github.com/victorhqc/canvas-scraper/workflows/Publish%20CI/badge.svg)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

![canvas-scraper preview](https://i.imgur.com/NDcgXsz.png)

## Motivación

La plataforma "Canvas" es una herramienta de educación utilizada por la Universidad de la Rioja
Internacional ([https://mexico.unir.net/](https://mexico.unir.net/)). La manera en que el material
para el estudiante se sube, no es la forma más ergonómica que existe, ya que sólo se puede leer
en el navegador o descargando cada tema en formato PDF. El cual no está mal, pero no se puede editar
o combinar en un sólo archivo.

En mi opinión personal, es mejor tener el texto con las imágenes en un formato "Markdown" y poder
exportar ese texto a cualquier otro formato que sea necesario, como PDF, utilizando
[Pandoc](https://pandoc.org/) y [LateX](https://www.latex-project.org/)

Este repositorio es el sucesor del
[primer intento](https://github.com/victorhqc/ARCHIVED_canvas-scraper).

## Alcance

El proyecto tiene como alcance generar una aplicación para la terminal (CLI) que pueda:

- Iniciar sesión en Canvas (Necesario para poder realizar el scraping)
- Convertir el material en HTML a un archivo Markdown
- Automáticamente descargar las imágenes y usarlas en el archivo Markdown.

El formateo post Markdown no forma parte de la especificación y se recomienda utilizar otras
herramientas como [Pandoc](https://pandoc.org/) y [LateX](https://www.latex-project.org/).

## Requisitos

- Node >= 12.13.1
- npm >= 6.12.1

## Instalación

```sh
npx canvas-scraper parse -u <USUARIO>

# O con instalación global (Sólo instalarlo una vez)
npm i -g canvas-scraper

canvas-scraper parse -u <USUARIO>
```

## Comandos

```sh
canvas-scraper <COMANDO> <ARGUMENTOS>

# Ejemplo
canvas-scraper parse -u FOO -p BAR
```

**Parse**: Obtiene el contenido de un curso y crea archivos de Markdown para cada tema.

Argumentos:

- `help`: Muestra la ayuda del comando
- `u` o `username`: Usuario de Canvas.
- `p` o `path` (Opcional): Directorio donde se guardará el contenido. Por defecto
  será el directorio actual
- `t` o `topic` (Opcional): Tema a leer, por defecto intentará con todos los temas
  del curso.
- `password` (Opcional): Contraseña de usuario.


## Desarrollo

### Ejecución

```sh
# Development
npm run build -- --watch

# Production
NODE_ENV=production npm run build

node ./dist/main.js parse
```
