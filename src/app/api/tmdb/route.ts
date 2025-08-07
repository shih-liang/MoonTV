import { NextResponse } from 'next/server';

import {
  buildTMDBUrl,
  convertTMDBMovieToDoubanItem,
  convertTMDBSeriesToDoubanItem,
  getSearchStrategy,
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
  const tag = searchParams.get('tag');
  const type = searchParams.get('type');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const pageStart = parseInt(searchParams.get('pageStart') || '0');

  // 验证参数
  if (!tag || !type) {
    return NextResponse.json(
      { error: '缺少必要参数：tag 或 type' },
      { status: 400 }
    );
  }

  if (!['tv', 'movie'].includes(type)) {
    return NextResponse.json(
      { error: 'type 参数必须是 tv 或 movie' },
      { status: 400 }
    );
  }

  if (pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: 'pageSize 必须在 1-100 之间' },
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

    // 特殊处理：综艺类型只支持电视剧
    if (tag === '综艺' && type === 'movie') {
      const result: DoubanResult = {
        code: 200,
        message: '获取成功',
        list: [],
      };
      return NextResponse.json(result);
    }

    // 使用智能搜索策略
    const strategy = getSearchStrategy(tag, type);
    const page = Math.floor(pageStart / pageSize) + 1;
    const params = { ...strategy.params, page };

    // 过滤掉undefined和null值
    const cleanParams: Record<string, string | number | boolean> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        cleanParams[key] = value;
      }
    });

    const target = buildTMDBUrl(strategy.endpoint, apiKey, cleanParams);

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
          if (type === 'movie') {
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
    let errorMessage = '获取 TMDB 搜索数据失败';
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
