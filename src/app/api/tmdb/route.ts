import { NextResponse } from 'next/server';

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string;
  vote_average: number;
  release_date: string;
  overview: string;
}

interface TMDBSeries {
  id: number;
  name: string;
  poster_path: string;
  vote_average: number;
  first_air_date: string;
  overview: string;
}

interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface DoubanItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
}

interface DoubanResult {
  code: number;
  message: string;
  list: DoubanItem[];
}

/**
 * 获取 TMDB 图片 URL
 */
function getTMDBImageUrl(posterPath: string, size = 'w500'): string {
  if (!posterPath) return '';
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

/**
 * 从日期字符串中提取年份
 */
function extractYear(dateString: string): string {
  if (!dateString) return '';
  const match = dateString.match(/(\d{4})/);
  return match ? match[1] : '';
}

/**
 * 将 TMDB 电影数据转换为 DoubanItem 格式
 */
function convertTMDBMovieToDoubanItem(movie: TMDBMovie): DoubanItem {
  return {
    id: movie.id.toString(),
    title: movie.title,
    poster: getTMDBImageUrl(movie.poster_path),
    rate: movie.vote_average ? movie.vote_average.toFixed(1) : '',
    year: extractYear(movie.release_date),
  };
}

/**
 * 将 TMDB 剧集数据转换为 DoubanItem 格式
 */
function convertTMDBSeriesToDoubanItem(series: TMDBSeries): DoubanItem {
  return {
    id: series.id.toString(),
    title: series.name,
    poster: getTMDBImageUrl(series.poster_path),
    rate: series.vote_average ? series.vote_average.toFixed(1) : '',
    year: extractYear(series.first_air_date),
  };
}

export const runtime = 'edge';

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

    // 构建搜索URL
    const page = Math.floor(pageStart / pageSize) + 1;
    const searchUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&language=zh-CN&query=${encodeURIComponent(
      tag
    )}&page=${page}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const tmdbData: TMDBResponse<TMDBMovie | TMDBSeries> =
      await response.json();

    // 转换数据格式
    const list: DoubanItem[] = tmdbData.results.map((item) => {
      if (type === 'movie') {
        return convertTMDBMovieToDoubanItem(item as TMDBMovie);
      } else {
        return convertTMDBSeriesToDoubanItem(item as TMDBSeries);
      }
    });

    const result: DoubanResult = {
      code: 200,
      message: '获取成功',
      list: list,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: '获取 TMDB 搜索数据失败' },
      { status: 500 }
    );
  }
}
