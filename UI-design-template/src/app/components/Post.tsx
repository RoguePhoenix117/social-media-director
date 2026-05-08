import { useState } from 'react';
import { Link2, Unlink, Sparkles, FileText, Check, AlertCircle } from 'lucide-react';
import { useDesign } from '../contexts/DesignContext';

interface SocialPlatform {
  id: string;
  name: string;
  icon: string;
  maxChars: number;
  connected: boolean;
  color: string;
}

const platforms: SocialPlatform[] = [
  { id: 'twitter', name: 'Twitter/X', icon: '𝕏', maxChars: 280, connected: true, color: 'blue' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', maxChars: 3000, connected: true, color: 'indigo' },
  { id: 'instagram', name: 'Instagram', icon: 'IG', maxChars: 2200, connected: false, color: 'pink' },
  { id: 'facebook', name: 'Facebook', icon: 'f', maxChars: 63206, connected: true, color: 'blue' },
  { id: 'threads', name: 'Threads', icon: '@', maxChars: 500, connected: false, color: 'gray' },
  { id: 'tiktok', name: 'TikTok', icon: '♪', maxChars: 2200, connected: false, color: 'red' },
];

export function Post() {
  const { colorScheme } = useDesign();
  const [masterPost, setMasterPost] = useState('');
  const [platformPosts, setPlatformPosts] = useState<Record<string, string>>(
    Object.fromEntries(platforms.map(p => [p.id, '']))
  );
  const [linkedPlatforms, setLinkedPlatforms] = useState<Set<string>>(
    new Set(platforms.map(p => p.id))
  );
  const [aiPrompt, setAiPrompt] = useState('');

  const handleMasterChange = (value: string) => {
    setMasterPost(value);
    linkedPlatforms.forEach(platformId => {
      setPlatformPosts(prev => ({ ...prev, [platformId]: value }));
    });
  };

  const handlePlatformChange = (platformId: string, value: string) => {
    setPlatformPosts(prev => ({ ...prev, [platformId]: value }));
    setLinkedPlatforms(prev => {
      const newSet = new Set(prev);
      newSet.delete(platformId);
      return newSet;
    });
  };

  const toggleLink = (platformId: string) => {
    setLinkedPlatforms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(platformId)) {
        newSet.delete(platformId);
      } else {
        newSet.add(platformId);
        setPlatformPosts(prev => ({ ...prev, [platformId]: masterPost }));
      }
      return newSet;
    });
  };

  const getCharStatus = (text: string, maxChars: number) => {
    const length = text.length;
    const percentage = (length / maxChars) * 100;
    if (length > maxChars) return { color: 'text-red-600', bg: 'bg-red-100', status: 'Over limit!' };
    if (percentage > 90) return { color: 'text-orange-600', bg: 'bg-orange-100', status: 'Almost there' };
    if (percentage > 70) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Getting close' };
    return { color: 'text-green-600', bg: 'bg-green-100', status: 'Good' };
  };

  const getColorStyles = () => {
    switch (colorScheme) {
      case 'ocean-blue':
        return {
          container: 'bg-slate-50',
          card: 'bg-white border border-gray-200 shadow-sm',
          heading: 'text-slate-900',
          text: 'text-slate-600',
          input: 'bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500',
          button: 'bg-blue-600 hover:bg-blue-700 text-white',
          badge: 'bg-blue-100 text-blue-700',
        };
      case 'royal-purple':
        return {
          container: 'bg-gray-50',
          card: 'bg-white border border-gray-200 shadow-sm',
          heading: 'text-gray-900',
          text: 'text-gray-600',
          input: 'bg-white border-gray-300 focus:border-indigo-500 focus:ring-indigo-500',
          button: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          badge: 'bg-indigo-100 text-indigo-700',
        };
      case 'sunset-gradient':
        return {
          container: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50',
          card: 'bg-white/80 backdrop-blur-sm border border-white shadow-xl',
          heading: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600',
          text: 'text-gray-700',
          input: 'bg-white/70 border-purple-300 focus:border-purple-500 focus:ring-purple-500',
          button: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white',
          badge: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700',
        };
    }
  };

  const styles = getColorStyles();

  return (
    <div className={`min-h-full ${styles.container}`}>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-4xl font-bold mb-2 ${styles.heading}`}>Create Post</h1>
          <p className={styles.text}>Compose and share content across all your social platforms</p>
        </div>

        {/* AI Assistant */}
        <div className={`${styles.card} p-6 rounded-xl mb-8`}>
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <h2 className={`text-xl font-bold ${styles.heading}`}>AI Content Assistant</h2>
          </div>
          <div className="flex gap-4">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Enter a prompt or paste a blog post URL..."
              className={`flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none ${styles.input}`}
            />
            <button className={`px-6 py-3 rounded-lg font-medium transition-colors ${styles.button}`}>
              Generate
            </button>
          </div>
        </div>

        {/* Master Post */}
        <div className={`${styles.card} p-6 rounded-xl mb-8`}>
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className={`text-xl font-bold ${styles.heading}`}>Master Post</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles.badge}`}>
              Synced to {linkedPlatforms.size} platform{linkedPlatforms.size !== 1 ? 's' : ''}
            </span>
          </div>
          <textarea
            value={masterPost}
            onChange={(e) => handleMasterChange(e.target.value)}
            placeholder="Write your post here... This content will be automatically synced to all linked platforms."
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none resize-none ${styles.input}`}
            rows={6}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className={`text-sm ${styles.text}`}>
              This post will be copied to all linked platform boxes below
            </p>
            <span className={`text-sm font-medium ${styles.text}`}>
              {masterPost.length} characters
            </span>
          </div>
        </div>

        {/* Platform Posts Grid */}
        <div className="mb-8">
          <h2 className={`text-2xl font-bold mb-6 ${styles.heading}`}>Platform Posts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platforms.map((platform) => {
              const isLinked = linkedPlatforms.has(platform.id);
              const postText = platformPosts[platform.id];
              const charStatus = getCharStatus(postText, platform.maxChars);

              return (
                <div
                  key={platform.id}
                  className={`${styles.card} p-5 rounded-xl ${
                    isLinked
                      ? colorScheme === 'ocean-blue' ? 'ring-2 ring-blue-300' :
                        colorScheme === 'royal-purple' ? 'ring-2 ring-indigo-300' :
                        'ring-2 ring-purple-300'
                      : ''
                  }`}
                >
                  {/* Platform Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-${platform.color}-400 to-${platform.color}-600 flex items-center justify-center text-white font-bold text-lg`}>
                        {platform.icon}
                      </div>
                      <div>
                        <h3 className={`font-bold ${styles.heading}`}>{platform.name}</h3>
                        <p className={`text-xs ${styles.text}`}>
                          {platform.connected ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleLink(platform.id)}
                      className={`p-2 rounded-lg transition-all ${
                        isLinked
                          ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                      title={isLinked ? 'Unlink from master' : 'Link to master'}
                    >
                      {isLinked ? <Link2 className="w-5 h-5" /> : <Unlink className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Post Content */}
                  <textarea
                    value={postText}
                    onChange={(e) => handlePlatformChange(platform.id, e.target.value)}
                    placeholder={
                      isLinked
                        ? 'Linked to master post...'
                        : platform.connected
                        ? 'Customize for this platform...'
                        : 'Connect platform to post...'
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none resize-none text-sm ${styles.input} ${
                      isLinked ? 'bg-blue-50/50' : ''
                    }`}
                    rows={4}
                    disabled={isLinked}
                  />

                  {/* Character Count & Status */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {postText.length <= platform.maxChars ? (
                        <Check className={`w-4 h-4 ${charStatus.color}`} />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`text-xs font-medium ${charStatus.color}`}>
                        {charStatus.status}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${charStatus.color}`}>
                      {postText.length} / {platform.maxChars}
                    </span>
                  </div>

                  {/* Action Button */}
                  <button
                    className={`w-full mt-4 px-4 py-2 rounded-lg font-medium transition-colors ${
                      platform.connected
                        ? styles.button
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!platform.connected}
                  >
                    {platform.connected ? 'Post Now' : 'Copy to Clipboard'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className={`${styles.card} p-6 rounded-xl`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`font-bold mb-1 ${styles.heading}`}>Ready to publish?</h3>
              <p className={styles.text}>
                {platforms.filter(p => p.connected).length} platforms connected
              </p>
            </div>
            <div className="flex gap-4">
              <button className="px-6 py-3 rounded-lg font-medium border-2 border-gray-300 hover:bg-gray-100 transition-colors">
                Save as Draft
              </button>
              <button className={`px-6 py-3 rounded-lg font-medium transition-colors ${styles.button}`}>
                Post to All Connected
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
