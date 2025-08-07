import { DoubanItem } from '@/lib/types';

// TMDB API 类型定义
export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  video: boolean;
}

export interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  origin_country: string[];
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface SearchStrategy {
  endpoint: string;
  params: Record<string, string | number | boolean>;
}

// TMDB API 基础 URL
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// 构建 TMDB API URL
export function buildTMDBUrl(
  endpoint: string,
  apiKey: string,
  params: Record<string, string | number | boolean> = {}
): string {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'zh-CN');
  url.searchParams.set('region', 'CN');

  // 添加其他参数
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

// 智能搜索策略
export function getSearchStrategy(tag: string, type: string): SearchStrategy {
  const baseParams: Record<string, string | number | boolean> = {
    include_adult: false,
    include_video: false,
  };

  // 电影搜索策略
  if (type === 'movie') {
    switch (tag) {
      case '热门':
        return {
          endpoint: '/movie/popular',
          params: baseParams,
        };
      case '最新':
        return {
          endpoint: '/movie/now_playing',
          params: baseParams,
        };
      case '即将上映':
        return {
          endpoint: '/movie/upcoming',
          params: baseParams,
        };
      case '高分':
      case '豆瓣高分':
        return {
          endpoint: '/movie/top_rated',
          params: baseParams,
        };
      case '华语':
        return {
          endpoint: '/discover/movie',
          params: {
            ...baseParams,
            with_origin_country: 'CN',
            sort_by: 'popularity.desc',
          },
        };
      case '欧美':
        return {
          endpoint: '/discover/movie',
          params: {
            ...baseParams,
            with_origin_country: 'US',
            sort_by: 'popularity.desc',
          },
        };
      case '韩国':
        return {
          endpoint: '/discover/movie',
          params: {
            ...baseParams,
            with_origin_country: 'KR',
            sort_by: 'popularity.desc',
          },
        };
      case '日本':
        return {
          endpoint: '/discover/movie',
          params: {
            ...baseParams,
            with_origin_country: 'JP',
            sort_by: 'popularity.desc',
          },
        };
      case '动漫':
        return {
          endpoint: '/discover/movie',
          params: {
            ...baseParams,
            with_genres: '16',
            sort_by: 'popularity.desc',
          },
        };
      case '纪录片':
        return {
          endpoint: '/discover/movie',
          params: {
            ...baseParams,
            with_genres: '99',
            sort_by: 'popularity.desc',
          },
        };
      case '冷门佳片':
        return {
          endpoint: '/discover/movie',
          params: {
            ...baseParams,
            sort_by: 'vote_average.desc',
            'vote_count.gte': 100,
          },
        };
      default:
        // 默认使用搜索
        return {
          endpoint: '/search/movie',
          params: {
            ...baseParams,
            query: tag,
          },
        };
    }
  }

  // 电视剧搜索策略
  if (type === 'tv') {
    switch (tag) {
      case '热门':
        return {
          endpoint: '/tv/popular',
          params: baseParams,
        };
      case '华语':
        return {
          endpoint: '/discover/tv',
          params: {
            ...baseParams,
            with_origin_country: 'CN',
            sort_by: 'popularity.desc',
          },
        };
      case '欧美':
        return {
          endpoint: '/discover/tv',
          params: {
            ...baseParams,
            with_origin_country: 'US',
            sort_by: 'popularity.desc',
          },
        };
      case '韩国':
        return {
          endpoint: '/discover/tv',
          params: {
            ...baseParams,
            with_origin_country: 'KR',
            sort_by: 'popularity.desc',
          },
        };
      case '日本':
        return {
          endpoint: '/discover/tv',
          params: {
            ...baseParams,
            with_origin_country: 'JP',
            sort_by: 'popularity.desc',
          },
        };
      case '动漫':
        return {
          endpoint: '/discover/tv',
          params: {
            ...baseParams,
            with_genres: '16',
            sort_by: 'popularity.desc',
          },
        };
      case '纪录片':
        return {
          endpoint: '/discover/tv',
          params: {
            ...baseParams,
            with_genres: '99',
            sort_by: 'popularity.desc',
          },
        };
      case '综艺':
        return {
          endpoint: '/discover/tv',
          params: {
            ...baseParams,
            with_genres: '10764',
            sort_by: 'popularity.desc',
          },
        };
      default:
        // 默认使用搜索
        return {
          endpoint: '/search/tv',
          params: {
            ...baseParams,
            query: tag,
          },
        };
    }
  }

  // 默认策略
  return {
    endpoint: '/movie/popular',
    params: baseParams,
  };
}

// 转换 TMDB 电影数据为豆瓣格式
export function convertTMDBMovieToDoubanItem(movie: TMDBMovie): DoubanItem {
  return {
    id: movie.id.toString(),
    title: movie.title || movie.original_title,
    poster: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : '',
    rate: movie.vote_average ? movie.vote_average.toFixed(1) : '',
    year: movie.release_date ? movie.release_date.split('-')[0] : '',
  };
}

// 转换 TMDB 电视剧数据为豆瓣格式
export function convertTMDBSeriesToDoubanItem(series: TMDBSeries): DoubanItem {
  return {
    id: series.id.toString(),
    title: series.name || series.original_name,
    poster: series.poster_path
      ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
      : '',
    rate: series.vote_average ? series.vote_average.toFixed(1) : '',
    year: series.first_air_date ? series.first_air_date.split('-')[0] : '',
  };
}

// 获取 TMDB 图片 URL
export function getTMDBImageUrl(path: string | null, size = 'w500'): string {
  if (!path) return '';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// 格式化评分
export function formatRating(rating: number): string {
  return rating ? rating.toFixed(1) : '';
}

// 格式化年份
export function formatYear(dateString: string): string {
  if (!dateString) return '';
  return dateString.split('-')[0];
}

// 错误处理工具
export function handleTMDBError(error: Error): string {
  // 检查是否是网络错误或超时错误
  if (error.name === 'AbortError') {
    return '请求超时，请稍后重试';
  }

  // 从错误消息中解析状态码
  const message = error.message;
  if (message.includes('401')) {
    return 'TMDB API Key 无效';
  } else if (message.includes('429')) {
    return 'TMDB API 请求过于频繁，请稍后再试';
  } else if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503')
  ) {
    return 'TMDB 服务器错误';
  } else {
    return '获取 TMDB 数据失败';
  }
}

// 缓存工具
export function getCacheKey(
  endpoint: string,
  params: Record<string, string | number | boolean>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return `${endpoint}?${sortedParams}`;
}
