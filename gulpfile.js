const gulp = require('gulp');
const fs = require('fs');
const pug = require('gulp-pug');
const favicons = require('gulp-favicons');
const sass = require('gulp-sass');
const imagemin = require('gulp-imagemin');
const watch = require('gulp-watch');
const data = require('gulp-data');
const template = require('gulp-template');
const plumber = require('gulp-plumber');
const webpack = require('webpack-stream');
const browserSync = require('browser-sync').create();
const cleanCSS = require('gulp-clean-css');
const getCSV = require('get-csv');
const rename = require('gulp-rename');
const pugLinter = require('gulp-pug-linter');
const notify = require('gulp-notify');
const sassGlob = require('gulp-sass-glob');
const replace = require('gulp-replace');

const siteData = require('./site.json');

gulp.task('pug', () => {
  gulp.src('./src/pug/pages/**/[^_]*.pug')
    .pipe(plumber())
    .pipe(pugLinter())
    .pipe(pugLinter.reporter((errors) => {
      if (errors.length) {
        notify.onError('Pug Lint Error');
      }
    }))
    .pipe(data((file) => ({site: siteData})))
    .pipe(pug({
      basedir: './src/pug',
      pretty: siteData.format,
    }))
    .pipe(gulp.dest('./dist'));
});

gulp.task('sass', () => {
  gulp.src('./src/scss/style.scss')
    .pipe(plumber())
    .pipe(sassGlob())
    .pipe(sass({
      outputStyle: siteData.format ? 'expanded' : 'compressed',
    }))
    .pipe(cleanCSS({
      level: 2,
    }))
    .pipe(gulp.dest('./dist'));
});

gulp.task('js', () => {
  return gulp.src('./src/js/entry.js')
    .pipe(plumber())
    .pipe(webpack({
      module: {
        loaders: [{
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          query: {
            presets: ['es2015'],
          },
        }],
      },
      output: {
        filename: 'script.js',
      },
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('image-copy', () =>
  gulp.src('./src/images/**/*')
  .pipe(gulp.dest('dist/imgs'))
);

gulp.task('image', () =>
  gulp.src('./src/images/**/*')
  .pipe(imagemin({
    progressive: true,
    interlaced: true,
  }))
  .pipe(gulp.dest('public/imgs'))
);

gulp.task('create-blank-pages', () => {
  getCSV('./pages.csv')
    .then((rows) => {
      rows.forEach((page) => {
        page.path += page.path.match(/\/$/) ? '' : '/';
        page.path += 'index.pug';

        if (fs.existsSync('./src/pug/pages' + page.path)) {
          return true;
        }

        gulp.src('./src/pug/lib/_template.pug')
          .pipe(template({
            title: page.title,
          }))
          .pipe(rename(page.path))
          .pipe(gulp.dest('./src/pug/pages', {
            overwrite: false,
          }));
      });
    });
});

gulp.task('favicon', () => {
  gulp.src('./src/favicon*')
    .pipe(favicons(siteData))
    .pipe(gulp.dest('./public'));
});

gulp.task('watch', ['build'], () => {
  watch('./src/scss/**/*.scss', () => {
    gulp.start('sass');
  });
  watch('./src/pug/**/*.pug', () => {
    gulp.start('pug');
  });
  watch('./src/images/**/*', () => {
    gulp.start('image-copy');
  });
  watch('./src/js/**/*.js', () => {
    gulp.start('js');
  });
  watch('./dist/**', () => {
    browserSync.reload();
  });
});

gulp.task('serve', ['watch'], () => {
  browserSync.init({
    open: true,
    ghostMode: false,
    server: {
      baseDir: './dist',
    },
  });
});

gulp.task('replaceUrl', () => {
  let baseUrl = siteData.url;
  if (baseUrl) {
    if (siteData.url.match(/.*\/$/)) {
      baseUrl = baseUrl.slice(0, -1);
    }
    gulp.src('./dist/**/*.{html,css}')
      .pipe(replace(/src="\/([^\/])/gm, `src="${siteData.url}/$1`))
      .pipe(replace(/href="\/([^\/?])/gm, `href="${siteData.url}/$1`))
      .pipe(replace(/url\("\/([^\/])/gm, `url("${siteData.url}/$1`))
      .pipe(gulp.dest('public/'));
  }
});

gulp.task('pre-release', () => {
  siteData.protect = siteData.isProtect && siteData.protectPassword;
  gulp.start(['build'], () => {
    gulp.src('./dist/**/*').pipe(gulp.dest('public/'));
  });
});

gulp.task('release', ['build', 'image', 'favicon'], () => {
  gulp.start(['build'], () => {
    if (siteData.isRelative) {
      gulp.start('replaceUrl');
      gulp.src('./dist/**/*.js')
      .pipe(gulp.dest('public/'));
    } else {
      gulp.src([
        './dist/**/*',
        '!./dist/imgs/**/*',
      ])
      .pipe(gulp.dest('public/'));
    }
  });
});

gulp.task('build', ['pug', 'sass', 'js', 'image-copy']);
gulp.task('default', ['serve']);
