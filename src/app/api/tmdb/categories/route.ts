import { NextResponse } from 'next/server';

import {
  buildTMDBUrl,
  convertTMDBMovieToDoubanItem,
  convertTMDBSeriesToDoubanItem,
  TMDBMovie,
  TMDBResponse,
  TMDBSeries,
} from '@/lib/tmdb.utils';
import { DoubanItem, DoubanResult } from '@/lib/types';

export const runtime = 'edge';

// 缓存配置
const CACHE_DURATION = 3600; // 1 小时缓存

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 获取参数
  const kind = searchParams.get('kind') || 'movie';
  const category = searchParams.get('category');
  const type = searchParams.get('type');
  const pageLimit = parseInt(searchParams.get('limit') || '20');
  const pageStart = parseInt(searchParams.get('start') || '0');

  // 验证参数
  if (!kind || !category || !type) {
    return NextResponse.json(
      { error: '缺少必要参数：kind 或 category 或 type' },
      { status: 400 }
    );
  }

  if (!['tv', 'movie'].includes(kind)) {
    return NextResponse.json(
      { error: 'kind 参数必须是 tv 或 movie' },
      { status: 400 }
    );
  }

  if (pageLimit < 1 || pageLimit > 100) {
    return NextResponse.json(
      { error: 'pageLimit 必须在 1-100 之间' },
      { status: 400 }
    );
  }

  if (pageStart < 0) {
    return NextResponse.json(
      { error: 'pageStart 不能小于 0' },
      { status: 400 }
    );
  }

  try {
    // 获取TMDB API Key
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'TMDB API Key 未配置' },
        { status: 500 }
      );
    }

    // 构建TMDB API URL
    let endpoint = '';
    let params: Record<string, string | number | boolean> = {};
    const page = Math.floor(pageStart / pageLimit) + 1;

    // 基础参数
    params.page = page;
    params.include_adult = false;
    params.include_video = false;

    if (kind === 'movie') {
      // 电影分类处理
      let baseEndpoint = '';
      const baseParams: Record<string, string | number | boolean> = {};

      // 根据主分类确定基础端点
      switch (category) {
        case '热门':
          baseEndpoint = '/movie/popular';
          break;
        case '最新':
          baseEndpoint = '/movie/now_playing';
          break;
        case '即将上映':
          baseEndpoint = '/movie/upcoming';
          break;
        case '高分':
        case '豆瓣高分':
          baseEndpoint = '/movie/top_rated';
          break;
        case '冷门佳片':
          baseEndpoint = '/discover/movie';
          baseParams.sort_by = 'vote_average.desc';
          baseParams['vote_count.gte'] = '100';
          break;
        default:
          baseEndpoint = '/movie/popular';
      }

      // 根据地区分类添加额外参数
      switch (type) {
        case '华语':
          if (baseEndpoint === '/discover/movie') {
            baseParams.with_origin_country = 'CN';
          } else {
            baseEndpoint = '/discover/movie';
            baseParams.with_origin_country = 'CN';
            baseParams.sort_by = 'popularity.desc';
          }
          break;
        case '欧美':
          if (baseEndpoint === '/discover/movie') {
            baseParams.with_origin_country = 'US';
          } else {
            baseEndpoint = '/discover/movie';
            baseParams.with_origin_country = 'US';
            baseParams.sort_by = 'popularity.desc';
          }
          break;
        case '韩国':
          if (baseEndpoint === '/discover/movie') {
            baseParams.with_origin_country = 'KR';
          } else {
            baseEndpoint = '/discover/movie';
            baseParams.with_origin_country = 'KR';
            baseParams.sort_by = 'popularity.desc';
          }
          break;
        case '日本':
          if (baseEndpoint === '/discover/movie') {
            baseParams.with_origin_country = 'JP';
          } else {
            baseEndpoint = '/discover/movie';
            baseParams.with_origin_country = 'JP';
            baseParams.sort_by = 'popularity.desc';
          }
          break;
        case '动漫':
          baseEndpoint = '/discover/movie';
          baseParams.with_genres = '16'; // 动画 genre ID
          baseParams.sort_by = 'popularity.desc';
          break;
        case '纪录片':
          baseEndpoint = '/discover/movie';
          baseParams.with_genres = '99'; // 纪录片 genre ID
          baseParams.sort_by = 'popularity.desc';
          break;
      }

      endpoint = baseEndpoint;
      // 合并参数
      params = { ...params, ...baseParams };
    } else {
      // 电视剧分类处理
      let baseEndpoint = '';
      const baseParams: Record<string, string | number | boolean> = {};

      // 根据 category 确定基础端点
      if (category === 'tv') {
        // 电视剧页面：根据 type 参数确定具体分类
        switch (type) {
          case 'tv':
            baseEndpoint = '/tv/popular';
            break;
          case 'tv_domestic':
            baseEndpoint = '/discover/tv';
            baseParams.with_origin_country = 'CN';
            baseParams.sort_by = 'popularity.desc';
            break;
          case 'tv_american':
            baseEndpoint = '/discover/tv';
            baseParams.with_origin_country = 'US';
            baseParams.sort_by = 'popularity.desc';
            break;
          case 'tv_japanese':
            baseEndpoint = '/discover/tv';
            baseParams.with_origin_country = 'JP';
            baseParams.sort_by = 'popularity.desc';
            break;
          case 'tv_korean':
            baseEndpoint = '/discover/tv';
            baseParams.with_origin_country = 'KR';
            baseParams.sort_by = 'popularity.desc';
            break;
          case 'tv_animation':
            baseEndpoint = '/discover/tv';
            baseParams.with_genres = '16'; // 动画 genre ID
            baseParams.sort_by = 'popularity.desc';
            break;
          case 'tv_documentary':
            baseEndpoint = '/discover/tv';
            baseParams.with_genres = '99'; // 纪录片 genre ID
            baseParams.sort_by = 'popularity.desc';
            break;
          default:
            baseEndpoint = '/tv/popular';
        }
      } else if (category === 'show') {
        // 综艺页面：根据 type 参数确定具体分类
        switch (type) {
          case 'show':
            baseEndpoint = '/discover/tv';
            baseParams.with_genres = '10764'; // 综艺 genre ID
            baseParams.sort_by = 'popularity.desc';
            break;
          case 'show_domestic':
            baseEndpoint = '/discover/tv';
            baseParams.with_genres = '10764'; // 综艺 genre ID
            baseParams.with_origin_country = 'CN'; // 国内
            baseParams.sort_by = 'popularity.desc';
            break;
          case 'show_foreign':
            baseEndpoint = '/discover/tv';
            baseParams.with_genres = '10764'; // 综艺 genre ID
            baseParams.with_origin_country = 'US'; // 国外（主要欧美）
            baseParams.sort_by = 'popularity.desc';
            break;
          default:
            baseEndpoint = '/discover/tv';
            baseParams.with_genres = '10764'; // 综艺 genre ID
            baseParams.sort_by = 'popularity.desc';
        }
      } else {
        // 默认返回热门电视剧
        baseEndpoint = '/tv/popular';
      }

      endpoint = baseEndpoint;
      // 合并参数
      params = { ...params, ...baseParams };
    }

    const target = buildTMDBUrl(endpoint, apiKey, params);

    // 添加请求超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 秒超时

    try {
      const response = await fetch(target, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MoonTV/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const tmdbData: TMDBResponse<TMDBMovie | TMDBSeries> =
        await response.json();

      // 转换数据格式
      const list: DoubanItem[] = tmdbData.results.map(
        (item: TMDBMovie | TMDBSeries) => {
          if (kind === 'movie') {
            return convertTMDBMovieToDoubanItem(item as TMDBMovie);
          } else {
            return convertTMDBSeriesToDoubanItem(item as TMDBSeries);
          }
        }
      );

      const result: DoubanResult = {
        code: 200,
        message: '获取成功',
        list: list,
      };

      // 设置缓存头
      const responseHeaders = new Headers();
      responseHeaders.set('Cache-Control', `public, max-age=${CACHE_DURATION}`);
      responseHeaders.set('ETag', `"${Date.now()}"`);

      return NextResponse.json(result, {
        headers: responseHeaders,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    // 根据错误类型返回不同的错误信息
    let errorMessage = '获取 TMDB 分类数据失败';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = '请求超时，请稍后重试';
        statusCode = 408;
      } else if (error.message.includes('401')) {
        errorMessage = 'TMDB API Key 无效';
        statusCode = 500;
      } else if (error.message.includes('429')) {
        errorMessage = 'TMDB API 请求过于频繁，请稍后再试';
        statusCode = 429;
      } else if (error.message.includes('500')) {
        errorMessage = 'TMDB 服务器错误';
        statusCode = 502;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
