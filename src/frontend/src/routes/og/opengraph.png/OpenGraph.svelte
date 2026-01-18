<script lang="ts">
	interface Props {
		title?: string;
		subtitle?: string;
		accentColor?: string;
	}

	let {
		title = 'Chithi',
		subtitle = 'Send up to 50 GB of files with end-to-end encryption',
		accentColor = '#3b82f6'
	}: Props = $props();

	// Style Constants for cleaner TS markup
	const cardStyle = `
		display: flex;
		width: 950px;
		height: 500px;
		background-color: #0f0f0f;
		border: 1px solid #222;
		border-radius: 40px;
		overflow: hidden;
		box-shadow: 0 30px 60px rgba(0,0,0,0.8);
	`;
</script>

<div
	style="
		height: 100%;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #050505;
		position: relative;
	"
>
	<div
		style="
		position: absolute;
		top: 0; left: 0; right: 0; bottom: 0;
		display: flex;
		background-image: 
			linear-gradient(to right, #121212 1px, transparent 1px),
			linear-gradient(to bottom, #121212 1px, transparent 1px);
		background-size: 50px 50px;
	"
	></div>

	<div
		style="
		position: absolute;
		top: 25%; left: 25%;
		width: 500px; height: 500px;
		background-color: {accentColor};
		filter: blur(140px);
		opacity: 0.12;
		border-radius: 100%;
	"
	></div>

	<div style={cardStyle}>
		<div
			style="
			flex: 1.2;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			padding: 50px;
			background-color: #111111;
			border-right: 1px solid #222;
		"
		>
			<div
				style="
				width: 100px;
				height: 100px;
				border-radius: 30px;
				background-color: #1a1a1a;
				border: 2px dashed #444;
				display: flex;
				align-items: center;
				justify-content: center;
				margin-bottom: 24px;
			"
			>
				<div style="font-size: 50px; color: {accentColor};">+</div>
			</div>

			<div style="font-size: 36px; font-weight: 800; color: white; margin-bottom: 12px;">
				Share Files
			</div>

			<p style="font-size: 18px; color: #888; text-align: center; line-height: 1.5; margin: 0;">
				{subtitle}
			</p>

			<div
				style="
				margin-top: 40px;
				background-color: white;
				color: black;
				padding: 16px 36px;
				border-radius: 14px;
				font-weight: 700;
				font-size: 20px;
				display: flex;
			"
			>
				Select Files
			</div>
		</div>

		<div
			style="
			flex: 0.8;
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			padding: 60px 40px;
			background-color: #0a0a0a;
		"
		>
			<div style="display: flex; flex-direction: column;">
				<span
					style="font-size: 14px; color: {accentColor}; font-weight: 700; letter-spacing: 3px; margin-bottom: 10px;"
				>
					PLATFORM
				</span>
				<h1
					style="font-size: 60px; font-weight: 900; color: white; margin: 0; letter-spacing: -2px;"
				>
					{title}
				</h1>
			</div>

			<div style="display: flex; align-items: center;">
				<div
					style="width: 40px; height: 2px; background-color: {accentColor}; margin-right: 15px;"
				></div>
				<span style="color: #555; font-size: 16px; font-weight: 500;"> End-to-end Encrypted </span>
			</div>
		</div>
	</div>
</div>
